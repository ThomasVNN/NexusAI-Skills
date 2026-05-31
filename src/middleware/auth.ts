import { FastifyRequest, FastifyReply } from 'fastify';

const PUBLIC_PATHS = ['/health', '/api/health'];

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (PUBLIC_PATHS.includes(request.url)) {
    return;
  }

  const apiKey = request.headers['x-api-key'];
  const authHeader = request.headers['authorization'];

  if (!apiKey && !authHeader) {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'API key or Authorization header required'
    });
    return;
  }

  const validKey = process.env.SKILLS_API_KEY || 'dev-key';

  if (apiKey && apiKey !== validKey) {
    reply.status(403).send({
      error: 'Forbidden',
      message: 'Invalid API key'
    });
    return;
  }

  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const validToken = process.env.SKILLS_JWT_SECRET || 'dev-secret';

    if (token !== validToken) {
      reply.status(403).send({
        error: 'Forbidden',
        message: 'Invalid authorization token'
      });
      return;
    }
  }
}
