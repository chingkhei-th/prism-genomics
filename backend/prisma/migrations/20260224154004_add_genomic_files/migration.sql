-- CreateTable
CREATE TABLE "genomic_files" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ipfsCid" TEXT NOT NULL,
    "blake3Hash" TEXT NOT NULL,
    "keyHex" TEXT NOT NULL,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "genomic_files_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "genomic_files" ADD CONSTRAINT "genomic_files_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
