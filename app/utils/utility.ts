import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import stream from 'stream';
import got from 'got';
import { BOTRANK_LINK } from '../constants/constants';
import { RedditBody } from '../service/reddit';

if (process.env.IS_OFFLINE) {
  const ffmpegInstaller = require('ffmpeg-static');
  const ffprobeInstaller = require('ffprobe-static');
  ffmpeg.setFfmpegPath(ffmpegInstaller);
  ffmpeg.setFfprobePath(ffprobeInstaller.path);
}

export class PresenceMap {
  video: boolean;
  audio: boolean;
}

export class Utility {
  static getMetadata(inputFilename: string): Promise<ffmpeg.FfprobeData> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputFilename, (err, metadata: ffmpeg.FfprobeData) => {
        if (err) {
          reject(err);
        }
        resolve(metadata);
      });
    });
  }

  static getPresenceOfStreams(metadata: ffmpeg.FfprobeData) {
    const presence: PresenceMap = {
      video: false,
      audio: false,
    };
    if (metadata.streams) {
      presence.video = metadata.streams.some((ffprobeStream) => {
        if (ffprobeStream.codec_type === 'video') {
          return true;
        }
        return false;
      });

      // Activate when ingur accepts vids
      presence.audio = metadata.streams.some((ffprobeStream) => {
        if (ffprobeStream.codec_type === 'audio') {
          return true;
        }
        return false;
      });
    }
    return presence;
  }

  static setParametersArray(
    redditBody: RedditBody,
    presenceMap: PresenceMap,
    playbackRate: number
  ) {
    // Check appropriate range beforehand
    let validAudioRange = false;
    if (playbackRate >= 0.5 && playbackRate <= 25.0) {
      validAudioRange = true;
    }

    let videoParameters = `[0:v]setpts=${(1 / playbackRate).toFixed(3)}*PTS`;
    if (redditBody.butterflow) {
      videoParameters +=
        ",minterpolate='mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps=60'";
    }
    videoParameters += '[v]';

    let audioParameters = '';
    if (presenceMap.audio && validAudioRange) {
      audioParameters = `;[0:a]atempo=${playbackRate}[a]`;
    }

    const parameters = [];
    parameters.push(`-r ${30}`);
    parameters.push(`-filter_complex ${videoParameters}${audioParameters}`);
    parameters.push('-map [v]');
    if (presenceMap.audio && validAudioRange) {
      parameters.push('-map [a]');
    }
    return parameters;
  }

  static processVideo(
    inputFilename: string,
    outputFilename: string,
    parameters: string[]
  ) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputFilename)
        .outputOptions(parameters)
        .on('start', () => {
          console.log('FFMPEG started processing');
        })
        .on('error', (err) => {
          reject(err.message);
        })
        .on('end', () => {
          resolve('Processing finished!');
        })
        .save(outputFilename);
    });
  }

  static runffmpeg(inputFileName: string, outputFileName: string) {
    return new Promise((resolve, reject) => {
      let fileMetadata;
      ffmpeg.ffprobe(inputFileName, (err, metadata) => {
        if (err) {
          console.error(err);
        }
        fileMetadata = metadata;
        console.log(fileMetadata);
        ffmpeg(inputFileName)
          .outputOptions([
            // '-filter_complex [0:v]setpts=0.5*PTS[v];[0:a]atempo=0.5[a]',
            // '-map [v]',
            // '-map [a]'
            // '-filter:v minterpolate=\'mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps=60\''
            '-filter_complex [0:v]setpts=0.5*PTS[v]',
            '-map [v]',
          ])
          .on('start', () => {
            console.log('FFMPEG started processing');
          })
          .on('error', (error) => {
            reject(error.message);
          })
          .on('end', () => {
            resolve('Processing finished!');
          })
          .save(outputFileName);
      });
    });
  }

  static validPlaybackRate(playbackRate: number) {
    if (playbackRate >= 0.1 && playbackRate <= 25.0) {
      return true;
    }
    return false;
  }

  static getInputFileLocation(url: string) {
    const date = new Date();
    const milliseconds = date.getTime();
    const urlParts = url.split('/');
    const fileNameParts = urlParts[urlParts.length - 1].split('.');
    let filename = fileNameParts[0].replace(/[^a-zA-Z0-9]/g, '');
    filename = `/tmp/${filename}`;
    filename += milliseconds;
    return filename;
  }

  static getOutputFileLocation(inputFileLocation: string, codec: string) {
    const fileExtensionParts = inputFileLocation.split('.');

    // Activate when imgur accepts vids
    const validExtension = ['webm', 'mp4', 'gif'];
    let outputFileExtension = codec;
    if (!validExtension.includes(codec)) {
      outputFileExtension = 'mp4';
    }

    // Deactivate when imgur accepts vids
    // const outputFileExtension = 'gif';

    fileExtensionParts[0] += 'out';
    if (fileExtensionParts.length > 1) {
      fileExtensionParts[fileExtensionParts.length - 1] = outputFileExtension;
    } else {
      fileExtensionParts.push(outputFileExtension);
    }
    return fileExtensionParts.join('.');
  }

  static fetchAndStoreFile(url: string, inputFileLocation: string) {
    return new Promise(async (resolve, reject) => {
      try {
        const writeStream = fs.createWriteStream(inputFileLocation);
        const reqStream = got.stream(url);

        reqStream.on('error', (error) => {
          throw new Error(error.message);
        });

        stream.pipeline(reqStream, writeStream, (err) => {
          if (err) {
            throw new Error(err.message);
          } else {
            console.log('File Stored');
            resolve(true);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  static getCodecFromMetadata(metadata: ffmpeg.FfprobeData) {
    for (let i = 0; i < metadata.streams.length; i += 1) {
      if (metadata.streams[i].codec_type === 'video') {
        // console.log('Codec Type = ' + metadata['streams'][i]['codec_name']);
        return metadata.streams[i].codec_name;
      }
    }
    return '';
  }

  static makeComment(
    redditBody: RedditBody,
    url: string,
    playbackRate: number,
    rank: number
  ) {
    let comment = '';
    const enter = '\n\n';

    if (redditBody.nsfw) {
      const nsfwComment = `### NSFW ${enter}`;
      comment += nsfwComment;
    }

    const commentHeader = `Here is your video at ${playbackRate}x speed`;
    const commentBody = url;
    let commentFooter =
      '^(I\'m a bot | Summon with) ^"[/u/redditspeedbot](/u/redditspeedbot) ^<speed>" ^| [^(Complete Guide)](https://www.reddit.com/user/redditspeedbot/comments/eqdo8u/redditspeedbot_guide) ^| ^(Do report bugs) ^[here](https://www.reddit.com/message/compose/?to=adityakrshnn&subject=RedditSpeedBot%20Issue) ^| ';
    const keepAliveMessage =
      '[^(Keep me alive)](https://www.buymeacoffee.com/redditspeedbot)';

    // if (rank) {
    //   const rankMessage = `[^(🏆#${rank})](${BOTRANK_LINK}) ^| `;
    //   commentFooter += rankMessage;
    // }

    commentFooter += keepAliveMessage;

    comment += `${commentHeader}${enter}${commentBody}${enter}${commentFooter}`;
    console.log(comment);
    return comment;
  }

  static sanityCheckForBody(body: RedditBody) {
    if (!body.link_id) {
      console.error('Missing link_id');
      return false;
    }
    if (!body.id) {
      console.error('Missing id');
      return false;
    }
    if (body.author === 'redditspeedbot') {
      console.error('Comment by self');
      return false;
    }
    return true;
  }

  static getDurationFromMetadata(metadata: ffmpeg.FfprobeData) {
    for (let i = 0; i < metadata.streams.length; i += 1) {
      if (!isNaN(metadata.format.duration)) {
        return metadata.format.duration;
      }
    }
    return 0;
  }

  static okResponse() {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Request received',
      }),
    };
  }

  static errorResponse(error: string) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: error,
      }),
    };
  }

  static makeUrlDownloadReady(url: string) {
    let finalUrl = url;

    if (Utility.isUrlAVideoUrl(finalUrl)) {
      finalUrl = finalUrl.replace('.gifv', '.mp4');
    }

    return finalUrl;
  }

  static isUrlAVideoUrl(url: string) {
    const acceptedTypes = ['.mp4', '.gif', '.gifv', '.webm'];
    for (let i = 0; i < acceptedTypes.length; i += 1) {
      if (url.includes(acceptedTypes[i])) {
        return true;
      }
    }
    return false;
  }

  static deleteFile(path: string) {
    fs.unlink(path, (err) => {
      if (err) {
        console.error(err);
      }
    });
  }

  static isValidHttpUrl(urlToTest: string) {
    let url;
    try {
      url = new URL(urlToTest);
    } catch (_) {
      return false;
    }
    return url.protocol === 'http:' || url.protocol === 'https:';
  }
}
