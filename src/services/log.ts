import axios from 'axios';

const sendLog = async (message: any) => {
  try {
    const payload = {
      content: '```' + `${JSON.stringify(message)}` + '```',
    };

    axios.post(
      'https://discord.com/api/webhooks/1292036272268906517/lMSdfw_HkoYsxt_POxlc3g81n07e3KO6wEPjHZRGWK8KR5gvVqKdLkT0h-jAvkTN9OeB',
      payload,
    );
  } catch (error) {}
};

const Log = {
  sendLog,
};

export default Log;
