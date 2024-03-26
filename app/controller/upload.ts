import { Catbox } from '../service/catbox';
import { Imgur } from '../service/imgur';
import { RedditBody } from '../service/reddit';

export class Upload {
  static uploadFileToHosting(
    redditBody: RedditBody,
    outputFileLocation: string,
    playbackRate: number
  ): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const finalDuration = redditBody.duration / playbackRate;
        if (finalDuration >= 59 || redditBody.nsfw) {
          const response = await Catbox.uploadFileToCatbox(outputFileLocation);
          resolve(response);
        } else {
          const response = await Imgur.uploadFileToImgur(outputFileLocation);
          resolve(response);
        }
      } catch (error) {
        reject(error);
      }
    });
  }
}
