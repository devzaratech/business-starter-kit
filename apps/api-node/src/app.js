import express from 'express';

export function createApp() {
  const app = express();

  app.get('/health', (_request, response) => {
    response.json({
      service: 'api-node',
      status: 'ok'
    });
  });

  return app;
}
