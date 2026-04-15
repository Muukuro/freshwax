import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo12345", 10);

  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email: "demo@example.com",
      name: "Demo Listener",
      timezone: "Europe/Amsterdam",
      passwordHash,
      settings: {
        create: {},
      },
      calendarToken: {
        create: {
          token: randomBytes(24).toString("hex"),
        },
      },
    },
  });

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  console.log("Seeded demo account:", user.email, "password: demo12345");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
