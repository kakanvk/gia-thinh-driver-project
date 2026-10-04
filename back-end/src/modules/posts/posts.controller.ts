import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './posts.service';
import type { CreatePostInput, ListPostsQuery, PublishPostInput, UpdatePostInput } from './posts.validation';

type IdParams = { id: string };

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listPosts(validated<ListPostsQuery>(req, 'query')));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getPost(validated<IdParams>(req, 'params').id));
}

export async function create(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createPost(req.user!, validated<CreatePostInput>(req, 'body')), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = validated<IdParams>(req, 'params');
  sendData(res, await service.updatePost(req.user!, id, validated<UpdatePostInput>(req, 'body')));
}

export function transition(action: service.PostAction) {
  return async (req: Request, res: Response): Promise<void> => {
    const { id } = validated<IdParams>(req, 'params');
    const input = action === 'publish' ? validated<PublishPostInput>(req, 'body') : {};
    sendData(res, await service.transitionPost(req.user!, id, action, input));
  };
}

export async function duplicate(req: Request, res: Response): Promise<void> {
  sendData(res, await service.duplicatePost(req.user!, validated<IdParams>(req, 'params').id), 201);
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removePost(req.user!, validated<IdParams>(req, 'params').id);
  res.status(204).end();
}
