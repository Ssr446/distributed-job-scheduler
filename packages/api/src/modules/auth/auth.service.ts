import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../config/logger.js';
import type { RegisterInput, LoginInput } from './auth.validator.js';
import type { JwtPayload } from '../../middleware/auth.js';

const SALT_ROUNDS = 12;

// In-memory token blacklist for simplicity (in a real app, use Redis)
const tokenBlacklist = new Set<string>();

export function isTokenBlacklisted(token: string): boolean {
  return tokenBlacklist.has(token);
}

function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
}

function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
  });
}

function generateTokens(payload: JwtPayload) {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
    expiresIn: env.JWT_EXPIRES_IN as any,
  };
}

export async function register(input: RegisterInput) {
  const { email, password, name } = input;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw AppError.conflict('A user with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Create user, default org, and membership in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: 'MEMBER',
      },
    });

    // Create a default personal organization
    const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-') + '-org';
    const org = await tx.organization.create({
      data: {
        name: `${name}'s Organization`,
        slug,
      },
    });

    // User becomes owner of their default org
    await tx.orgMembership.create({
      data: {
        userId: user.id,
        orgId: org.id,
        role: 'OWNER',
      },
    });

    return { user, org };
  });

  const tokenPayload: JwtPayload = {
    userId: result.user.id,
    email: result.user.email,
    role: result.user.role,
  };

  const tokens = generateTokens(tokenPayload);

  logger.info({ userId: result.user.id, email }, 'User registered');

  return {
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
    },
    organization: {
      id: result.org.id,
      name: result.org.name,
      slug: result.org.slug,
    },
    ...tokens,
  };
}

export async function login(input: LoginInput) {
  const { email, password } = input;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Prevent timing attacks by hashing anyway
    await bcrypt.compare(password, 'dummy');
    throw AppError.unauthorized('Invalid email or password');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw AppError.unauthorized('Invalid email or password');
  }

  const tokenPayload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const tokens = generateTokens(tokenPayload);

  logger.info({ userId: user.id, email }, 'User logged in');

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    ...tokens,
  };
}

export async function refreshToken(token: string) {
  if (isTokenBlacklisted(token)) {
    throw AppError.unauthorized('Invalid refresh token');
  }

  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;

    // Verify user still exists
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      throw AppError.unauthorized('User no longer exists');
    }

    // Blacklist the old refresh token (refresh token rotation)
    tokenBlacklist.add(token);

    const tokenPayload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const tokens = generateTokens(tokenPayload);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      ...tokens,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized('Refresh token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw AppError.unauthorized('Invalid refresh token');
    }
    throw error;
  }
}

export async function logout(token: string) {
  if (token) {
    tokenBlacklist.add(token);
    logger.info('User logged out, token blacklisted');
  }
  return { success: true };
}

export const getProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      orgMemberships: {
        select: {
          role: true,
          organization: {
            select: { id: true, name: true, slug: true }
          }
        }
      }
    }
  });

  if (!user) throw AppError.notFound('User');

  return {
    ...user,
    organizations: user.orgMemberships.map((m) => ({ ...m.organization, role: m.role })),
    orgMemberships: undefined,
  };
};

export const updateProfile = async (userId: string, data: { name?: string }) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { name: data.name },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      orgMemberships: {
        select: {
          role: true,
          organization: {
            select: { id: true, name: true, slug: true }
          }
        }
      }
    }
  });

  return {
    ...user,
    organizations: user.orgMemberships.map((m) => ({ ...m.organization, role: m.role })),
    orgMemberships: undefined,
  };
};
