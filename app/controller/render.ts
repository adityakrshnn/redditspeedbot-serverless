import { BotRanks } from '../service/botranks';
import { Reddit } from '../service/reddit';
import { Sentry } from '../service/sentry';
import { Utility } from '../utils/utility';
import { Upload } from './upload';

const BLOCKED_SUBREDDITS = JSON.parse(process.env.BLOCKED_SUBREDDITS ?? '[]');

export class Render {
  constructor() {}

  static async processVideo(event: any) {
    const sentry = new Sentry().getSentry();
    try {
      let redditBody = event.body;
      if (typeof event.body === 'string') {
        redditBody = JSON.parse(event.body);
      }
      console.log(redditBody);
      const reddit = new Reddit(redditBody);

      if (!Utility.sanityCheckForBody(redditBody)) {
        const error = 'Missing link_id or id or comment by self';
        return Utility.errorResponse(error);
      }

      const comment = await Reddit.getComment(redditBody.id);

      /**
       * Check for blocked subreddits
       */
      if (BLOCKED_SUBREDDITS.includes(comment.subreddit_name_prefixed)) {
        console.log(
          `Comment from blocked subreddit ${comment.subreddit_name_prefixed}: ${redditBody.id}, ${redditBody.link_id}`
        );
        await sentry.flush(2000);
        return Utility.okResponse();
      }

      // Get playback rate from comment
      const playbackRate = await reddit.getPlaybackRateFromComment(comment);
      if (!playbackRate) {
        const error = 'Comment corrupted or Playback rate not within range';
        console.error(error);
        return Utility.errorResponse(error);
      }

      // Get url from request body
      const url = await Reddit.getUrlToProcess(redditBody);
      if (!url) {
        throw Error('No url found in comment or post');
      }

      // Get input file location
      const inputFileLocation = Utility.getInputFileLocation(url);

      // Fetch and store the file from URL
      await Utility.fetchAndStoreFile(url, inputFileLocation);

      // Get Metadata from file
      const metadata = await Utility.getMetadata(inputFileLocation);
      const codec = Utility.getCodecFromMetadata(metadata);

      redditBody.duration = Utility.getDurationFromMetadata(metadata);

      console.log(
        `File Size: ${((metadata.format.size ?? 0) / (1024 * 1024)).toFixed(
          2
        )} MB`
      );
      console.log(`File Duration: ${redditBody.duration} seconds`);

      // Get output file location
      const outputFileLocation = Utility.getOutputFileLocation(
        inputFileLocation,
        codec
      );

      // Check for presence of streams
      const presence = Utility.getPresenceOfStreams(metadata);
      if (!presence.video) {
        const error = 'No video streams';
        console.log(error);
        return Utility.errorResponse(error);
      }

      /**
       * Start fetching bot rank
       */
      const botranks = new BotRanks();
      // botranks.startFetchingBotRank();

      // Process video
      const parameters = Utility.setParametersArray(
        redditBody,
        presence,
        playbackRate
      );
      const ffmpegMessage = await Utility.processVideo(
        inputFileLocation,
        outputFileLocation,
        parameters
      );
      console.log(ffmpegMessage);

      // Upload file to hosting
      const finalUrl = await Upload.uploadFileToHosting(
        redditBody,
        outputFileLocation,
        playbackRate
      );
      console.log(finalUrl);

      if (!Utility.isValidHttpUrl(finalUrl)) {
        const error = 'Invalid URL formed';
        console.log(error);
        return Utility.errorResponse(error);
      }

      // Make comment on reddit
      const responseComment = Utility.makeComment(
        redditBody,
        finalUrl,
        playbackRate,
        botranks.rank
      );
      const redditMessage = await reddit.commentOnReddit(responseComment);
      console.log(redditMessage);

      // Delete Files
      Utility.deleteFile(inputFileLocation);
      Utility.deleteFile(outputFileLocation);

      // Flush Sentry
      await sentry.flush(2000);

      return Utility.okResponse();
    } catch (error) {
      sentry.captureException(error);
      await sentry.flush(2000);

      console.error(error);
      return Utility.errorResponse(error);
    }
  }
}
