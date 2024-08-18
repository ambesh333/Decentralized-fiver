import express from "express";
import userRouter from "./routers/user";
import workerRouter from "./routers/worker";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

import * as dotenv from "dotenv";
dotenv.config();

app.use("/v1/user", userRouter);
app.use("/v1/worker", workerRouter);

app.listen(3000);
