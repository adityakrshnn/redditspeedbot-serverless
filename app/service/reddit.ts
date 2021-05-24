import got from 'got/dist/source';
import snoowrap from 'snoowrap';
import { REGEX_PATTERNS } from '../constants/constants';
import { Utility } from '../utils/utility';
import { Gfycat } from './gfycat';
import { Sentry } from './sentry';
import { Streamable } from './streamable';

const sentry = new Sentry().getSentry();

const snoo = new snoowrap({
  userAgent: `/u/${process.env.REDDIT_USERNAME}`,
  clientId: process.env.REDDIT_KEY,
  clientSecret: process.env.REDDIT_SECRET,
  username: process.env.REDDIT_USERNAME,
  password: process.env.REDDIT_PASSWORD,
});
snoo.config({ continueAfterRatelimitError: true });

export class RedditBody {
  id: string;
  link_id: string;
  butterflow: boolean;
  title: string;
  nsfw: boolean;
  author: string;
  duration: number;
}

export class Reddit {
  redditBody: RedditBody;
  constructor(redditBody: RedditBody) {
    this.redditBody = redditBody;
  }

  commentOnReddit(comment: string) {
    return new Promise((resolve, reject) => {
      if (this.redditBody.id) {
        snoo
          .getComment(this.redditBody.id)
          .reply(comment)
          .then((response) => {
            resolve(response);
          })
          .catch(async (error) => {
            console.error(error);

            // Failed to comment, try sending a message
            try {
              await this.sendResponseAsMessage(comment);
              resolve('Message sent successfully');
            } catch (err) {
              reject(err);
            }
          });
      } else {
        console.log('Comment was');
        console.log(comment);
        reject(new Error('Could not find comment ID'));
      }
    });
  }

  static async getComment(commentID: string) {
    try {
      const comment = await snoo.getComment(commentID).fetch();
      if (!comment || !comment.body) {
        return new Error('No comment found');
      }
      if (comment.body === '[deleted]') {
        return new Error('Comment was deleted');
      }
      return comment;
    } catch (error) {
      return error;
    }
  }

  getPlaybackRateFromComment(commentID: string): Promise<number> {
    return new Promise(async (resolve, reject) => {
      try {
        const comment = await Reddit.getComment(commentID);
        const commentBody = comment.body;
        const commentParts = commentBody.split(' ');
        let positionOfUsername = -1;
        for (let i = 0; i < commentParts.length; i += 1) {
          if (commentParts[i].toLowerCase().includes('u/redditspeedbot')) {
            positionOfUsername = i;
            break;
          }
        }
        // const positionOfUsername = commentParts.indexOf('/u/redditspeedbot');
        if (positionOfUsername === -1) {
          resolve(null);
        }

        if (!commentParts[positionOfUsername + 1]) {
          resolve(null);
        }

        if (
          commentParts[positionOfUsername + 2] &&
          commentParts[positionOfUsername + 2] === 'butterflow'
        ) {
          this.redditBody.butterflow = true;
        }

        let playbackRate = parseFloat(
          commentParts[positionOfUsername + 1]
            .toLowerCase()
            .replace('x', '')
            .replace(',', '.')
        );
        if (isNaN(playbackRate)) {
          resolve(null);
        }

        // Thresholding playback rate
        playbackRate = parseFloat(playbackRate.toFixed(2));
        if (playbackRate < 0.1) {
          playbackRate = 0.1;
        } else if (playbackRate > 25.0) {
          playbackRate = 25;
        }

        resolve(playbackRate);
      } catch (error) {
        reject(error);
      }
    });
  }

  static async getUrlFromRedditLink(url: string) {
    try {
      let manipulatedUrl = url;
      if (url[url.length - 1] !== '/') {
        manipulatedUrl += '/';
      }
      manipulatedUrl += '.json';

      const response = await got(manipulatedUrl);
      const body = JSON.parse(response.body);

      if (!body[0]?.data?.children[0]?.data) {
        throw new Error('Improper structure at getUrlFromRedditLink');
      }

      const { data } = body[0].data.children[0];
      if (
        data.media &&
        data.media.reddit_video &&
        data.media.reddit_video.fallback_url
      ) {
        return data.media.reddit_video.fallback_url;
      }

      if (
        data.crosspost_parent_list &&
        data.crosspost_parent_list[0] &&
        data.crosspost_parent_list[0].media &&
        data.crosspost_parent_list[0].media.reddit_video &&
        data.crosspost_parent_list[0].media.reddit_video.fallback_url
      ) {
        return data.crosspost_parent_list[0].media.reddit_video.fallback_url;
      }

      throw new Error('No fallback url whatsoever at getUrlFromRedditLink');
    } catch (error) {
      throw new Error(error);
    }
  }

  static async getUrlToProcess(redditBody: RedditBody) {
    try {
      const parentID = await Reddit.getParentID(redditBody.id);
      if (parentID.includes('t1_')) {
        let url = await Reddit.getUrlFromComment(parentID);
        if (url) {
          return url;
        }

        // If no url is found
        url = await Reddit.getUrlFromBody(redditBody);
        return url;
      }

      // If comment is top-level
      const url = await Reddit.getUrlFromBody(redditBody);
      return url;
    } catch (error) {
      console.error(error);
      return '';
    }
  }

  static async getUrlFromBody(redditBody: RedditBody) {
    try {
      if (!redditBody.link_id) {
        Promise.reject(new Error('No link_id in body'));
        return new Error('No link_id in body');
      }

      const submission = await snoo.getSubmission(redditBody.link_id).fetch();
      let url = '';
      let urlParts;
      if (!submission) {
        Promise.reject(new Error('No submission found'));
        return new Error('No submission found');
      }

      // Set Title
      redditBody.title = submission.title;

      // Set nsfw flag
      if (submission.over_18) {
        redditBody.nsfw = true;
      }

      if (
        submission.media &&
        submission.media.reddit_video &&
        submission.media.reddit_video.fallback_url
      ) {
        url = submission.media.reddit_video.fallback_url;
        return url;
      }

      if (
        submission.preview &&
        submission.preview.reddit_video_preview &&
        submission.preview.reddit_video_preview.fallback_url
      ) {
        url = submission.preview.reddit_video_preview.fallback_url;
        return url;
      }

      if (!submission.url) {
        Promise.reject(new Error('No url found in post'));
        return new Error('No url found in post');
      }

      // Check for streamable domain
      if (submission.domain && submission.domain.includes('streamable')) {
        url = submission.url;
        urlParts = url.split('/');
        const key = urlParts[urlParts.length - 1];
        const streamableUrl = await Streamable.getUrlFromStreamable(key);
        return streamableUrl;
      }

      url = Utility.makeUrlDownloadReady(submission.url);

      // Check for gfycat url
      if (url.includes('gfycat')) {
        urlParts = url.split('/');
        const fileKey = urlParts[urlParts.length - 1].split('-')[0];
        const gfycatUrl = await Gfycat.getUrlFromGfycat(fileKey, true);
        return gfycatUrl;
      }

      // Check for reddit url
      if (url.includes('v.redd.it')) {
        const redditPermalink = `https://reddit.com${submission.permalink}`;
        const redditUrl = await Reddit.getUrlFromRedditLink(redditPermalink);
        return redditUrl;
      }

      return url;
    } catch (error) {
      console.error(error);
      return '';
    }
  }

  static getParentID(commentID: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const comment = await Reddit.getComment(commentID);
        resolve(comment.parent_id);
      } catch (error) {
        reject(error);
      }
    });
  }

  static async getUrlFromComment(commentID: string) {
    try {
      const comment = await Reddit.getComment(commentID);
      const commentBody = comment.body;

      for (const key in REGEX_PATTERNS) {
        const regexPattern = REGEX_PATTERNS[key];
        if (regexPattern.test(commentBody)) {
          const matches = commentBody.match(regexPattern);
          let url = matches[0];
          let urlParts;

          url = Utility.makeUrlDownloadReady(url);

          // Check for streamable domain
          if (url.includes('streamable')) {
            urlParts = url.split('/');
            const key = urlParts[urlParts.length - 1];
            const streamableUrl = await Streamable.getUrlFromStreamable(key);
            return streamableUrl;
          }

          // Check for gfycat url
          if (url.includes('gfycat')) {
            urlParts = url.split('/');
            const fileKey = urlParts[urlParts.length - 1].split('-')[0];
            const gfycatUrl = await Gfycat.getUrlFromGfycat(fileKey, true);
            return gfycatUrl;
          }

          return url;
        }
      }
      return '';
    } catch (error) {
      console.error(error);
      return '';
    }
  }

  sendResponseAsMessage(comment: string) {
    return new Promise((resolve, reject) => {
      if (this.redditBody.id) {
        snoo
          .getComment(this.redditBody.id)
          .author.name.then(async (username: string) => {
            let subredditName = 'the desired subreddit';

            // Get subreddit name
            try {
              const subredditDisplayName = snoo.getComment(this.redditBody.id)
                .subreddit.display_name;
              if (!subredditDisplayName) {
                throw new Error('Could not get subreddit name');
              }

              subredditName = `r/${subredditDisplayName}`;
            } catch (error) {
              // Capture in sentry
              const noSubredditNameObject = {
                event: 'Could not get subreddit name',
                error,
              };
              sentry.captureException(noSubredditNameObject);

              console.error('Could not get subreddit name');
            }

            comment += `\n\n\n\n_(You are getting this message delivered to your inbox because unfortunately, Redditspeedbot was unable to comment in ${subredditName})_`;

            // Send message to user
            snoo
              .composeMessage({
                to: username,
                subject: 'Redditspeedbot response',
                text: comment,
              })
              .then((response) => {
                resolve(response);
              })
              .catch((error) => {
                reject(error);
              });
          })
          .catch((error) => {
            console.error('Could not find username');
            reject(error);
          });
      }
    });
  }
}
