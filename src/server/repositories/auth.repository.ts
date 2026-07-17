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

type CreateUserWithInitialSessionInput = CreateUserInput & {
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

export async function createUserWithInitialSession(_input: CreateUserWithInitialSessionInput) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        username: _input.username,
        passwordHash: _input.passwordHash,
        agreedToTermsAt: _input.agreedToTermsAt,
        agreedToPrivacyAt: _input.agreedToPrivacyAt
      },
      select: {
        id: true,
        username: true
      }
    });

    await tx.authSession.create({
      data: {
        userId: user.id,
        tokenHash: _input.tokenHash,
        expiresAt: _input.expiresAt,
        userAgent: _input.userAgent ?? null,
        ipAddress: _input.ipAddress ?? null
      }
    });

    await tx.userSettings.create({
      data: {
        userId: user.id
      }
    });

    return user;
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

export async function touchAuthSessionByTokenHash(_tokenHash: string) {
  return prisma.authSession.updateMany({
    where: { tokenHash: _tokenHash },
    data: { lastUsedAt: new Date() }
  });
}

export async function deleteExpiredAuthSessions(now = new Date()) {
  return prisma.authSession.deleteMany({
    where: { expiresAt: { lte: now } }
  });
}

export async function deleteUserById(userId: string) {
  return prisma.user.delete({
    where: { id: userId }
  });
}
