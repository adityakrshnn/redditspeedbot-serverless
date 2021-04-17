import got from 'got/dist/source';
import fs from 'fs';
import { RedditBody } from './reddit';
import FormData from 'form-data';

class GfyCatAuthResponseBody {
  access_token: string;
}

class GfyCatFilenameBody {
  gfyname: string;
}

export class Gfycat {
  static getFileExtension(fileLocation: string) {
    const fileParts = fileLocation.split('.');
    return fileParts[fileParts.length - 1];
  }

  static async checkStatusOfUrl(fileKey: string) {
    try {
      console.log(`Checking status of ${fileKey}`);
      const checkStatusUrl = `https://api.gfycat.com/v1/gfycats/fetch/status/${fileKey}`;

      const response = await got(checkStatusUrl);

      if (response.statusCode !== 200) {
        throw new Error('Wrong status code at checkStatusOfUrl');
      }

      const parsedBody = JSON.parse(response.body);
      return parsedBody;
    } catch (error) {
      throw new Error(error);
    }
  }

  static sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static async getInfoFromGfycat(fileKey: string) {
    try {
      console.log(`Getting info of ${fileKey}`);
      const checkStatusUrl = `https://api.gfycat.com/v1/gfycats/${fileKey}`;

      const response = await got(checkStatusUrl);

      if (response.statusCode !== 200) {
        throw new Error('Wrong status code at checkStatusOfUrl');
      }

      const parsedBody = JSON.parse(response.body);

      if (parsedBody.gfyItem.mobileUrl) {
        return parsedBody.gfyItem.mobileUrl;
      }

      if (parsedBody.gfyItem.mp4Url) {
        return parsedBody.gfyItem.mp4Url;
      }

      throw new Error('No urls found');
    } catch (error) {
      throw new Error(error);
    }
  }

  static async getUrlFromGfycat(fileKey: string, withExtension: boolean) {
    let uploadComplete = false;
    let checkCount = 0;
    while (!uploadComplete) {
      try {
        checkCount += 1;
        const response = await this.checkStatusOfUrl(fileKey);
        if (response.task) {
          if (response.task === 'complete') {
            uploadComplete = true;
            if (response.gfyname && !withExtension) {
              const genericUrl = `https://gfycat.com/${response.gfyname}`;
              return genericUrl;
            }
            if (response.mobileUrl) {
              return response.mobileUrl;
            }
            if (response.mp4url) {
              return response.mp4Url;
            }
          } else {
            console.log(response.task);
            if (response.task === 'error') {
              return response.errorMessage.description;
            }
            if (checkCount === 3 && response.task === 'NotFoundo') {
              return new Error('Not found for too long!');
            }
            const waitingPeriod = response.time
              ? Number(response.time) * 1000
              : 5000;
            console.log(`Waiting for ${waitingPeriod}`);
            await this.sleep(waitingPeriod);
          }
        }
      } catch (error) {
        return error;
      }
    }

    let finalUrl = '';

    try {
      finalUrl = await this.getInfoFromGfycat(fileKey);
    } catch (error) {
      console.error(error);
    } finally {
      if (finalUrl) {
        return finalUrl;
      }
      return new Error(null);
    }
  }

  static async uploadFileToGfycat(
    outputFileLocation: string,
    playbackRate: number,
    redditBody: RedditBody
  ) {
    try {
      const gfycatAccessToken = await this.getGfycatToken();
      const gfycatFileKey = await this.getGfycatUploadKey(
        gfycatAccessToken,
        playbackRate,
        redditBody
      );

      const form = new FormData();
      form.append('key', gfycatFileKey);
      form.append('file', fs.createReadStream(outputFileLocation));

      await got.post('https://filedrop.gfycat.com', { body: form });

      const url = await this.getUrlFromGfycat(gfycatFileKey, false);
      return url;
    } catch (error) {
      throw new Error(error);
    }
  }

  static getFileType(outputFileLocation: string) {
    const extension = this.getFileExtension(outputFileLocation);
    const imageTypes = ['gif'];
    const videoTypes = ['mp4', 'webm'];
    if (imageTypes.includes(extension)) {
      return 'image';
    }
    if (videoTypes.includes(extension)) {
      return 'video';
    }
    return null;
  }

  static async getGfycatToken() {
    try {
      const authBody = {
        grant_type: 'client_credentials',
        client_id: process.env.gfycatClientId,
        client_secret: process.env.gfycatClientSecret,
      };

      const response = await got.post('https://api.gfycat.com/v1/oauth/token', {
        json: authBody,
        responseType: 'json',
      });
      return (<GfyCatAuthResponseBody>response.body).access_token;
    } catch (error) {
      throw new Error(error);
    }
  }

  static async getGfycatUploadKey(
    gfycatAccessToken: string,
    playbackRate: number,
    redditBody: RedditBody
  ) {
    try {
      const jsonData = {
        title: `${redditBody.title} [${playbackRate}x]`,
        nsfw: 0,
      };

      // Set NSFW flag
      if (redditBody.nsfw) {
        jsonData.nsfw = 1;
      }

      const authHeaders = {
        Authorization: `Bearer ${gfycatAccessToken}`,
      };

      const response = await got.post('https://api.gfycat.com/v1/gfycats', {
        headers: authHeaders,
        json: jsonData,
        responseType: 'json',
      });

      return (<GfyCatFilenameBody>response.body).gfyname;
    } catch (error) {
      throw new Error(error);
    }
  }
}
