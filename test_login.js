const { z } = require('zod');

const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address').toLowerCase(),
    password: z.string().min(1, 'Password is required'),
  }),
});

async function run() {
  try {
    const schema = { body: loginSchema.shape.body };
    const reqBody = { email: 'test@example.com', password: 'password123' };
    const result = await schema.body.parseAsync(reqBody);
    console.log('Success:', result);
  } catch (e) {
    console.log('Error:', e.errors);
  }
}

run();
