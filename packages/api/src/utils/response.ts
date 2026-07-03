import { Response } from 'express';

export const sendSuccess = (res: Response, data: any, statusCode = 200) => {
  if (data && data.meta) {
    res.status(statusCode).json({ success: true, data: data.data, meta: data.meta });
  } else {
    res.status(statusCode).json({ success: true, data });
  }
};

export const sendError = (res: Response, statusCode: number, code: string, message: string, details?: any) => {
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
  });
};

export const paginate = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});
