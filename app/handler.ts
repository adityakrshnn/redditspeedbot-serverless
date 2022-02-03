import { Handler } from 'aws-lambda';
import { Render } from './controller/render';

export const process: Handler = (event: any) => {
  return Render.processVideo(event);
};
