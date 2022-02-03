import got from 'got';

export class Streamable {
  static async getUrlFromStreamable(key: string) {
    try {
      const streamableUrl = `https://redditspeedbot@Reddit_speed2*@api.streamable.com/videos/${key}`;

      const response = await got(streamableUrl);
      const parsedBody = JSON.parse(response.body);

      if (parsedBody?.files?.mp4?.url) {
        let finalUrl = parsedBody.files.mp4.url;
        if (!finalUrl.includes('https:')) {
          finalUrl = `https:${finalUrl}`;
        }

        return finalUrl;
      }
      throw new Error('No url found in streamble response');
    } catch (error) {
      throw new Error(error);
    }
  }
}
