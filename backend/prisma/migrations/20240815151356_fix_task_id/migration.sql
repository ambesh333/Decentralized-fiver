/*
  Warnings:

  - You are about to drop the column `task_int` on the `Option` table. All the data in the column will be lost.
  - Added the required column `task_id` to the `Option` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Option" DROP CONSTRAINT "Option_task_int_fkey";

-- AlterTable
ALTER TABLE "Option" DROP COLUMN "task_int",
ADD COLUMN     "task_id" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Option" ADD CONSTRAINT "Option_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
