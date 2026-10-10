import { Router } from 'express';
import { getMenu } from '../data/menu.js';

export const menuRouter = Router();

menuRouter.get('/', (_req, res) => {
  res.json(getMenu());
});
