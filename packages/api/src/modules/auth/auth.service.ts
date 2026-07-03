import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../config/logger.js';
import type { RegisterInput, LoginInput } from './auth.validator.js';
import type { JwtPayload } from '../../middleware/auth.js';
import crypto from 'crypto';

const SALT_ROUNDS = 12;

function generateTokens(payload: Omit<JwtPayload, 'jti'>) {
  const accessJti = crypto.randomUUID();
  const refreshJti = crypto.randomUUID();
  
  return {
    accessToken: jwt.sign({ ...payload, jti: accessJti }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    }),
    refreshToken: jwt.sign({ ...payload, jti: refreshJti }, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
    }),
    expiresIn: env.JWT_EXPIRES_IN as any,
  };
}

export async function register(input: RegisterInput) {
  const { email, password, name } = input;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw AppError.conflict('A user with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: 'MEMBER',
      },
    });

    const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-') + '-org';
    const org = await tx.organization.create({
      data: {
        name: `${name}'s Organization`,
        slug,
      },
    });

    await tx.orgMembership.create({
      data: {
        userId: user.id,
        orgId: org.id,
        role: 'OWNER',
      },
    });

    return { user, org };
  });

  const tokenPayload: Omit<JwtPayload, 'jti'> = {
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
    await bcrypt.compare(password, 'dummy');
    throw AppError.unauthorized('Invalid email or password');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw AppError.unauthorized('Invalid email or password');
  }

  const tokenPayload: Omit<JwtPayload, 'jti'> = {
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
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;

    const revoked = await prisma.revokedToken.findUnique({ where: { jti: decoded.jti } });
    if (revoked) {
      throw AppError.unauthorized('Refresh token has been revoked');
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      throw AppError.unauthorized('User no longer exists');
    }

    // Refresh Token Rotation: Revoke the used refresh token
    const expiresAt = new Date((decoded.exp || 0) * 1000);
    await prisma.revokedToken.create({
      data: { jti: decoded.jti, expiresAt }
    });

    const tokenPayload: Omit<JwtPayload, 'jti'> = {
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

export async function logout(accessToken?: string, refreshToken?: string) {
  const tokensToRevoke = [];
  
  if (accessToken) {
    try {
      const decodedAccess = jwt.decode(accessToken) as JwtPayload;
      if (decodedAccess?.jti) tokensToRevoke.push({ jti: decodedAccess.jti, expiresAt: new Date((decodedAccess.exp || 0) * 1000) });
    } catch (e) {}
  }
  
  if (refreshToken) {
    try {
      const decodedRefresh = jwt.decode(refreshToken) as JwtPayload;
      if (decodedRefresh?.jti) tokensToRevoke.push({ jti: decodedRefresh.jti, expiresAt: new Date((decodedRefresh.exp || 0) * 1000) });
    } catch (e) {}
  }

  for (const t of tokensToRevoke) {
    try {
      await prisma.revokedToken.create({
        data: { jti: t.jti, expiresAt: t.expiresAt }
      });
    } catch (e) {
      // Ignore if already revoked (unique constraint)
    }
  }

  logger.info('User logged out, tokens blacklisted');
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
