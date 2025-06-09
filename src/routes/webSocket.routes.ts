import { Router } from 'express';

const router = Router();

// This route will be used to upgrade the connection to a WebSocket
router.get('/ws', (_req, res) => {
    // This endpoint is for WebSocket connections only.
    // The actual upgrade is handled by the server's 'upgrade' event.
    res.send('This is a WebSocket endpoint. Please connect using a WebSocket client.');
});

export default router; 