import { Router } from 'express';
import * as branches from '../branches/branches.controller';
import { validate } from '../../middlewares/validate.middleware';
import * as pricing from '../pricing/pricing.controller';
import { publicPricingQuerySchema } from '../pricing/pricing.validation';
import * as publicPosts from '../posts/posts.public';
import { publicPostsQuerySchema, publicSlugParamsSchema } from '../posts/posts.public';
import { createRateLimiter } from '../../middlewares/rateLimit.middleware';
import * as publicLeads from '../leads/leads.public';
import { publicLeadSchema } from '../leads/leads.public';
import * as publicClasses from '../classes/classes.public';
import { publicClassesQuerySchema } from '../classes/classes.validation';
import * as publicExams from '../exams/exams.public';
import { publicExamsQuerySchema } from '../exams/exams.validation';
import * as settings from '../settings/settings.controller';

export function createPublicRouter(): Router {
  const router = Router();
  router.get('/branches', branches.listPublic);
  router.get('/settings', settings.getPublic);
  router.get('/pricing', validate({ query: publicPricingQuerySchema }), pricing.getPublic);
  router.get('/categories', publicPosts.listCategories);
  router.get('/posts', validate({ query: publicPostsQuerySchema }), publicPosts.listPosts);
  router.get('/posts/:slug', validate({ params: publicSlugParamsSchema }), publicPosts.getPost);
  router.get('/classes/upcoming', validate({ query: publicClassesQuerySchema }), publicClasses.upcoming);
  router.get('/exams/upcoming', validate({ query: publicExamsQuerySchema }), publicExams.upcoming);
  const leadLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    message: 'Bạn đã gửi quá nhiều yêu cầu, vui lòng thử lại sau hoặc gọi hotline',
  });
  router.post('/leads', leadLimiter, validate({ body: publicLeadSchema }), publicLeads.submit);
  return router;
}
