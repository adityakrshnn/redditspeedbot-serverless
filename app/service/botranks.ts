import got from 'got';

class BotRanksResponseBody {
  rank: number;
}

export class BotRanks {
  rank: number = null;
  constructor() {}

  async startFetchingBotRank() {
    try {
      const { body } = await got(
        'https://botranks.com/api/getrank/redditspeedbot',
        {
          responseType: 'json',
        }
      );
      this.rank = (<BotRanksResponseBody>body).rank;
      console.log(`Rank fetched successfully ${this.rank}`);
    } catch (error) {
      console.error('Failed to fetch rank');
    }
  }
}
