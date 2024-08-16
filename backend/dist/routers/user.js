"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const express_1 = require("express");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_presigned_post_1 = require("@aws-sdk/s3-presigned-post");
const types_1 = require("../types");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const __1 = require("..");
const middleware_1 = require("../middleware");
const router = (0, express_1.Router)();
const DEFAULT_TITLE = "Select the most clickable thumbnail";
const accessKeyId = process.env.ACCESS_KEY_ID;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;
const s3Client = new client_s3_1.S3Client({
    credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
    },
    region: "us-east-1",
});
const prismaClient = new client_1.PrismaClient();
router.post("/task", middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //@ts-ignore
    const userId = req.userId;
    const body = req.body;
    const parsedData = types_1.createTaskInput.safeParse(body);
    if (!parsedData.success) {
        return res.status(411).json({
            meassge: "You've sent the wrong inputs",
        });
    }
    let response = yield prismaClient.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const response = yield prismaClient.task.create({
            data: {
                title: (_a = parsedData.data.title) !== null && _a !== void 0 ? _a : DEFAULT_TITLE,
                amount: "1",
                signature: parsedData.data.signature,
                user_id: userId,
            },
        });
        yield tx.option.createMany({
            data: parsedData.data.options.map((x) => ({
                image_url: x.imageUrl,
                task_id: response.id,
            })),
        });
        return response;
    }));
    res.json({
        id: response.id,
    });
}));
router.get("/presignedUrl", middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //@ts-ignore
    const userId = req.userId;
    const { url, fields } = yield (0, s3_presigned_post_1.createPresignedPost)(s3Client, {
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
}));
router.post("/signin", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const hardCodedWalletAddress = "0x99537334F44E532384Dd503fBB2fDFc4846641d4";
    const existingUser = yield prismaClient.user.findFirst({
        where: {
            address: hardCodedWalletAddress,
        },
    });
    if (existingUser) {
        const token = jsonwebtoken_1.default.sign({
            userId: existingUser.id,
        }, __1.JWT_SECRET);
        res.json({
            token,
        });
    }
    else {
        const user = yield prismaClient.user.create({
            data: {
                address: hardCodedWalletAddress,
            },
        });
        const token = jsonwebtoken_1.default.sign({
            userId: user.id,
        }, __1.JWT_SECRET);
        res.json({
            token,
        });
    }
}));
exports.default = router;
