import got from 'got/dist/source';
import fs from 'fs';
import FormData from 'form-data';

const IMGUR_CLIENT_ID = process.env.IMGUR_CLIENT_ID;
const IMGUR_ALBUM_DELETE_HASH = process.env.IMGUR_ALBUM_DELETE_HASH;

export type UploadResponse = {
  data: { link: string };
};

export class Imgur {
  static async uploadFileToImgur(outputFileLocation: string) {
    try {
      const headers = {
        Authorization: `Client-ID ${IMGUR_CLIENT_ID}`,
      };
      const form = new FormData();
      form.append('type', 'file');
      form.append('video', fs.createReadStream(outputFileLocation));
      form.append('album', IMGUR_ALBUM_DELETE_HASH);
      form.append('disable_audio', 1);

      const response: UploadResponse = await got
        .post('https://api.imgur.com/3/upload', {
          headers: headers,
          body: form,
        })
        .json();

      return response.data.link;
    } catch (error) {
      throw new Error(error);
    }
  }
}
