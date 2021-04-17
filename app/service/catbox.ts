/* eslint-disable no-console */
import fs from 'fs';
import got from 'got/dist/source';
import FormData from 'form-data';

export class Catbox {
  static async uploadFileToCatbox(outputFileLocation: string) {
    try {
      const outputReadStream = fs.createReadStream(outputFileLocation);

      console.log('Uploading file to catbox...');

      const form = new FormData();
      form.append('reqtype', 'fileupload');
      form.append('userhash', process.env.CATBOX_USERHASH);
      form.append('fileToUpload', outputReadStream);

      const response = await got.post('https://catbox.moe/user/api.php', {
        body: form,
      });

      return response.body;
    } catch (error) {
      throw new Error(error);
    }
  }
}
