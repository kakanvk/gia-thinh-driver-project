import { Router } from 'express';
import * as branches from '../branches/branches.controller';
import { validate } from '../../middlewares/validate.middleware';
import * as pricing from '../pricing/pricing.controller';
import { publicPricingQuerySchema } from '../pricing/pricing.validation';
import * as publicPosts from '../posts/posts.public';
import { publicPostsQuerySchema, publicSlugParamsSchema } from '../posts/posts.public';
import * as settings from '../settings/settings.controller';

export function createPublicRouter(): Router {
  const router = Router();
  router.get('/branches', branches.listPublic);
  router.get('/settings', settings.getPublic);
  router.get('/pricing', validate({ query: publicPricingQuerySchema }), pricing.getPublic);
  router.get('/categories', publicPosts.listCategories);
  router.get('/posts', validate({ query: publicPostsQuerySchema }), publicPosts.listPosts);
  router.get('/posts/:slug', validate({ params: publicSlugParamsSchema }), publicPosts.getPost);
  return router;
}
