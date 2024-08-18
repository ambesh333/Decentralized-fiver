import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { createTaskInput } from "../types";

import jwt from "jsonwebtoken";
import { JWT_SECRET, TOTAL_DECIMALS } from "../config";
import { authMiddleware } from "../middleware";
const router = Router();

const DEFAULT_TITLE = "Select the most clickable thumbnail";

const accessKeyId = process.env.ACCESS_KEY_ID as string;
const secretAccessKey = process.env.SECRET_ACCESS_KEY as string;

const s3Client = new S3Client({
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  },
  region: "us-east-1",
});

const prismaClient = new PrismaClient();

router.get("/task", authMiddleware, async (req, res) => {
  //@ts-ignore
  const taskId: string = req.query.taskId;
  //@ts-ignore

  const userId: string = req.userId;

  const taskDeatils = await prismaClient.task.findFirst({
    where: {
      user_id: Number(userId),
      id: Number(taskId),
    },
    include: {
      options: true,
    },
  });

  if (!taskDeatils) {
    return res.status(411).json({
      meassage: "You dont have access to this task",
    });
  }

  const response = await prismaClient.submission.findMany({
    where: {
      task_id: Number(taskId),
    },
    include: {
      option: true,
    },
  });

  const result: Record<
    string,
    {
      count: number;
      option: {
        imageUrl: string;
      };
    }
  > = {};

  taskDeatils.options.forEach((option) => {
    result[option.id] = {
      count: 0,
      option: {
        imageUrl: option.image_url,
      },
    };
  });

  response.forEach((r) => {
    result[r.option_id].count++;
  });

  res.json({
    result,
  });
});

router.post("/task", authMiddleware, async (req, res) => {
  //@ts-ignore
  const userId = req.userId;
  const body = req.body;
  const parsedData = createTaskInput.safeParse(body);
  if (!parsedData.success) {
    return res.status(411).json({
      meassge: "You've sent the wrong inputs",
    });
  }
  let response = await prismaClient.$transaction(async (tx) => {
    const response = await prismaClient.task.create({
      data: {
        title: parsedData.data.title ?? DEFAULT_TITLE,
        amount: 1 * TOTAL_DECIMALS,
        signature: parsedData.data.signature,
        user_id: userId,
      },
    });

    await tx.option.createMany({
      data: parsedData.data.options.map((x) => ({
        image_url: x.imageUrl,
        task_id: response.id,
      })),
    });
    return response;
  });
  res.json({
    id: response.id,
  });
});

router.get("/presignedUrl", authMiddleware, async (req, res) => {
  //@ts-ignore
  const userId = req.userId;

  const { url, fields } = await createPresignedPost(s3Client, {
    Bucket: "decentralized-fiver-333",
    Key: `images/${userId}/${Math.random()}/image.png`,
    Conditions: [
      ["content-length-range", 0, 5 * 1024 * 1024], // 5 MB max
    ],
    Fields: {
      success_action_status: "201",
      "Content-Type": "image/png",
    },
    Expires: 3600,
  });

  console.log({ url, fields });

  res.json({
    preSignedUrl: url,
    fields,
  });
});

router.post("/signin", async (req, res) => {
  const hardCodedWalletAddress = "0x99537334F44E532384Dd503fBB2fDFc4846641d4";
  const existingUser = await prismaClient.user.findFirst({
    where: {
      address: hardCodedWalletAddress,
    },
  });
  if (existingUser) {
    const token = jwt.sign(
      {
        userId: existingUser.id,
      },
      JWT_SECRET
    );
    res.json({
      token,
    });
  } else {
    const user = await prismaClient.user.create({
      data: {
        address: hardCodedWalletAddress,
      },
    });
    const token = jwt.sign(
      {
        userId: user.id,
      },
      JWT_SECRET
    );
    res.json({
      token,
    });
  }
});

export default router;
