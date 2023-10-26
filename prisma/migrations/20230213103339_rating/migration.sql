-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "review" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RatingComment" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_RatingComment_AB_unique" ON "_RatingComment"("A", "B");

-- CreateIndex
CREATE INDEX "_RatingComment_B_index" ON "_RatingComment"("B");

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RatingComment" ADD CONSTRAINT "_RatingComment_A_fkey" FOREIGN KEY ("A") REFERENCES "CommentTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RatingComment" ADD CONSTRAINT "_RatingComment_B_fkey" FOREIGN KEY ("B") REFERENCES "Rating"("id") ON DELETE CASCADE ON UPDATE CASCADE;
