import axios, { AxiosRequestConfig } from 'axios';

const isExpired: (expireDate?: Date) => boolean = (expireDate) => {
  /* if expire date is null or undefined it's not expired */
  if (!expireDate) return false;

  return expireDate <= new Date();
};

const youtubeUrlToEmbed: (url: string) => string = (url) => {
  // parse youtube link to embed
  // type 1 | https://www.youtube.com/watch?v=HCdI-8FsZs8
  // type 2 | https://youtu.be/HCdI-8FsZs8
  const embedPrefix = 'https://www.youtube.com/embed';

  if (url.includes('watch?v=')) return `${embedPrefix}/${url.split('watch?v=')[1]}`;
  else if (url.includes('youtu.be/')) return `${embedPrefix}/${url.split('youtu.be/')[1]}`;
  else throw new Error('youtube link is not valid.');
};

const sendRequest = async ({ url, method, headers, ...props }: AxiosRequestConfig) => {
  try {
    const { status, data } = await axios(props);
    return { status, data };
  } catch (error) {
    return { status: 401, data: null };
  }
};
export default {
  isExpired,
  youtubeUrlToEmbed,
  sendRequest,
};
