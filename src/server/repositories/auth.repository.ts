import { prisma } from "@/server/db/prisma";

type CreateUserInput = {
  username: string;
  passwordHash: string;
  agreedToTermsAt: Date;
  agreedToPrivacyAt: Date;
};

type CreateAuthSessionInput = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
};

export async function findUserByUsername(_username: string) {
  return prisma.user.findUnique({
    where: { username: _username }
  });
}

export async function createUser(_input: CreateUserInput) {
  return prisma.user.create({
    data: _input,
    select: {
      id: true,
      username: true
    }
  });
}

export async function createAuthSession(_input: CreateAuthSessionInput) {
  return prisma.authSession.create({
    data: {
      userId: _input.userId,
      tokenHash: _input.tokenHash,
      expiresAt: _input.expiresAt,
      userAgent: _input.userAgent ?? null,
      ipAddress: _input.ipAddress ?? null
    }
  });
}

export async function findAuthSessionByTokenHash(_tokenHash: string) {
  return prisma.authSession.findUnique({
    where: { tokenHash: _tokenHash },
    include: {
      user: {
        select: {
          id: true,
          username: true
        }
      }
    }
  });
}

export async function deleteAuthSessionByTokenHash(_tokenHash: string) {
  return prisma.authSession.deleteMany({
    where: { tokenHash: _tokenHash }
  });
}

export async function deleteUserById(userId: string) {
  return prisma.user.delete({
    where: { id: userId }
  });
}
