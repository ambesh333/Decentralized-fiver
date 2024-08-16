import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { JWT_SECRET, WORKER_JWT_SECRET } from "../config";
import jwt from "jsonwebtoken";
import { workerMiddleware } from "../middleware";
import { getNextTask } from "../db";
import { createSubmissionInput } from "../types";

const TOTAL_SUBMISSIONS = 100;

const prismaClient = new PrismaClient();

const router = Router();

router.post("/signin", async (req, res) => {
  const hardCodedWalletAddress = "0x99537334Fdgud503fBB2fDFc4846641d4";
  const existingUser = await prismaClient.worker.findFirst({
    where: {
      address: hardCodedWalletAddress,
    },
  });
  if (existingUser) {
    const token = jwt.sign(
      {
        userId: existingUser.id,
      },
      WORKER_JWT_SECRET
    );
    res.json({
      token,
    });
  } else {
    const user = await prismaClient.worker.create({
      data: {
        address: hardCodedWalletAddress,
        pending_amount: 0,
        locked_amount: 0,
      },
    });
    const token = jwt.sign(
      {
        userId: user.id,
      },
      WORKER_JWT_SECRET
    );
    res.json({
      token,
    });
  }
});

router.get("/nextTask", workerMiddleware, async (req, res) => {
  //@ts-ignore
  const userId = req.userId;

  const task = await getNextTask(Number(userId));

  if (!task) {
    res.status(411).json({
      message: "No more tasks left for you to review",
    });
  } else {
    res.json({
      task,
    });
  }
});

router.post("/submission", workerMiddleware, async (req, res) => {
  //@ts-ignore
  const userId = req.userId;
  const body = req.body;
  const parsedBody = createSubmissionInput.safeParse(body);

  if (parsedBody.success) {
    const task = await getNextTask(Number(userId));
    if (!task || task?.id != Number(parsedBody.data.taskId)) {
      return res.status(411).json({
        message: "Incorrect task id",
      });
    }

    const amount = (Number(task.amount) / TOTAL_SUBMISSIONS).toString();

    const submission = prismaClient.$transaction(async (tx) => {
      const submission = await prismaClient.submission.create({
        data: {
          option_id: Number(parsedBody.data.selection),
          worker_id: userId,
          task_id: Number(parsedBody.data.taskId),
          amount: amount,
        },
      });

      await prismaClient.worker.update({
        where: {
          id: userId,
        },
        data: {
          pending_amount: {
            increment: Number(amount),
          },
        },
      });
      return submission;
    });

    const nextTask = await getNextTask(Number(userId));

    if (!nextTask) {
      res.status(411).json({
        message: "No task for now",
      });
    }
    res.json({
      nextTask,
      amount,
    });
  } else {
    res.status(411).json({
      message: "Error",
    });
  }
});
export default router;
