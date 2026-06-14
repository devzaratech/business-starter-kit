import express from 'express';

const app = express();
const port = process.env.NODE_INTEGRATION_PORT || 3001;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'api-node' });
});

app.listen(port, () => {
  console.log(`Node integration service listening on port ${port}`);
});
