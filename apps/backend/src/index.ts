import express from 'express';
import cors from 'cors';
import { register, login } from './auth';
import tradingRouter from './routes/trading';
import { authenticate } from './middleware/auth';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/auth/register', register);
app.post('/api/auth/login', login);

app.use('/api/trading', authenticate, tradingRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API Gateway on ${PORT}`));