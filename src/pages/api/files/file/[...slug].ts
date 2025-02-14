import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { JWT, getToken } from 'next-auth/jwt';

import { validateServerSession } from '@/src/utils/auth/session';
import { OpenAIError } from '@/src/utils/server';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';

import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from '../../auth/[...nextauth]';

import fetch from 'node-fetch';
import { Readable } from 'stream';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  const token = await getToken({ req });
  if (!isSessionValid || !token) {
    return;
  }

  try {
    if (req.method === 'GET') {
      return await handleGetRequest(req, token, res);
    } else if (req.method === 'PUT') {
      return await handlePutRequest(req, token, res);
    } else if (req.method === 'DELETE') {
      return await handleDeleteRequest(req, token, res);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: unknown) {
    logger.error(error);
    if (error instanceof OpenAIError) {
      return res
        .status(parseInt(error.code, 10) || 500)
        .send(error.message || errorsMessages.generalServer);
    }
    return res.status(500).send(errorsMessages.errorDuringFileRequest);
  }
};

export default handler;

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

async function handlePutRequest(
  req: NextApiRequest,
  token: JWT | null,
  res: NextApiResponse,
) {
  const readable = Readable.from(req);
  const slugs = Array.isArray(req.query.slug)
    ? req.query.slug
    : [req.query.slug];

  if (!slugs || slugs.length === 0) {
    throw new OpenAIError('No file path provided', '', '', '400');
  }
  const url = `${process.env.DIAL_API_HOST}/v1/${encodeURI(slugs.join('/'))}`;
  const proxyRes = await fetch(url, {
    method: 'PUT',
    headers: {
      ...getApiHeaders({ jwt: token?.access_token as string }),
      'Content-Type': req.headers['content-type'] as string,
    },
    body: readable,
  });

  const json: unknown = await proxyRes.json();
  if (!proxyRes.ok) {
    throw new OpenAIError(
      (typeof json === 'string' && json) || proxyRes.statusText,
      '',
      '',
      proxyRes.status + '',
    );
  }

  return res.status(200).send(json);
}

async function handleGetRequest(
  req: NextApiRequest,
  token: JWT | null,
  res: NextApiResponse,
) {
  const slugs = Array.isArray(req.query.slug)
    ? req.query.slug
    : [req.query.slug];

  if (!slugs || slugs.length === 0) {
    throw new OpenAIError('No file path provided', '', '', '400');
  }
  const url = `${process.env.DIAL_API_HOST}/v1/${encodeURI(slugs.join('/'))}`;
  const proxyRes = await fetch(url, {
    headers: getApiHeaders({ jwt: token?.access_token as string }),
  });

  if (!proxyRes.ok) {
    throw new OpenAIError(proxyRes.statusText, '', '', proxyRes.status + '');
  }

  res.status(proxyRes.status);
  res.setHeader('transfer-encoding', 'chunked');
  res.setHeader(
    'Content-Type',
    proxyRes.headers.get('Content-Type') || 'text/plain',
  );

  proxyRes.body?.pipe(res);
}

async function handleDeleteRequest(
  req: NextApiRequest,
  token: JWT | null,
  res: NextApiResponse,
) {
  const slugs = Array.isArray(req.query.slug)
    ? req.query.slug
    : [req.query.slug];

  if (!slugs || slugs.length === 0) {
    throw new OpenAIError('No file path provided', '', '', '400');
  }
  const url = `${process.env.DIAL_API_HOST}/v1/${encodeURI(slugs.join('/'))}`;

  const proxyRes = await fetch(url, {
    method: 'DELETE',
    headers: getApiHeaders({ jwt: token?.access_token as string }),
  });

  if (!proxyRes.ok) {
    const json: unknown = await proxyRes.json();
    throw new OpenAIError(
      (typeof json === 'string' && json) || proxyRes.statusText,
      '',
      '',
      proxyRes.status + '',
    );
  }

  return res.status(200).send({});
}
