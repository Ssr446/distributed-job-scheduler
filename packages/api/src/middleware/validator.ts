import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodEffects, ZodError } from 'zod';

interface ValidationSchema {
  body?: AnyZodObject | ZodEffects<AnyZodObject>;
  query?: AnyZodObject | ZodEffects<AnyZodObject>;
  params?: AnyZodObject | ZodEffects<AnyZodObject>;
}

export function validate(schema: ValidationSchema) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query) as Record<string, string>;
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params) as Record<string, string>;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(error);
      } else {
        next(error);
      }
    }
  };
}
