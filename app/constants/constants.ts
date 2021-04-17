export const BOTRANK_LINK = 'https://botranks.com/';

export const REGEX_PATTERNS = {
  gfycat: /https?:\/\/(?:\w+?\.)?gfycat\.com\/(?:(?:\S*?\/)(?!\/))*([a-zA-Z]*)/gm,
  imgur: /http(?:s)?:\/\/(?:\w+?\.)?imgur.com\/(a\/)?(gallery\/)?(([a-zA-Z0-9]{5,7})|(([a-zA-Z0-9]{5,7})|([a-zA-Z0-9]{5,7})))(?:\S*)/gm,
  redditGif: /http(?:s)?:\/\/i.redd.it\/(.*?)\.gif/gm,
  redditVideo: /https?:\/\/v.redd.it\/(\w+)/gm,
  streamable: /https?:\/\/streamable.com\/(\w+)/gm,
  catbox: /https?:\/\/(?:\w+?\.)?catbox\.moe\/(\w+)(?:\.mp4+)?/gm,
};
