import { Handler } from 'aws-lambda';
// import dotenv from 'dotenv';
// import path from 'path';
// const dotenvPath = path.join(__dirname, '../', `config/.env`);
// dotenv.config({
//   path: dotenvPath,
// });

import { Render } from './controller/render';

export const process: Handler = (event: any) => {
  return Render.processVideo(event);
};
