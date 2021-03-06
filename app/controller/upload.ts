import { Catbox } from '../service/catbox';
import { Gfycat } from '../service/gfycat';
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
        if (finalDuration >= 59) {
          const response = await Catbox.uploadFileToCatbox(outputFileLocation);
          resolve(response);
        } else {
          const response = await Gfycat.uploadFileToGfycat(
            outputFileLocation,
            playbackRate,
            redditBody
          );
          resolve(response);
        }
      } catch (error) {
        reject(error);
      }
    });
  }
}
