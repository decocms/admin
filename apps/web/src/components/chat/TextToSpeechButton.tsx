
interface TextToSpeechButtonProps {
  text: string;
}

export const speak = async (text: string) => {
  console.log("text", text);
  const requestBody = {
    input: {
      text: text,
    },
    voice: {
      languageCode: "pt-BR",
      name: "pt-BR-Chirp3-HD-Achernar",
      ssmlGender: "FEMALE",
    },
    audioConfig: {
      audioEncoding: "MP3",
    },
  };

  // Make API call to Google Cloud Text-to-Speech
  const response = await fetch(
    "https://texttospeech.googleapis.com/v1/text:synthesize",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // You'll need to replace this with your actual API key or authentication method
        "X-goog-api-key": ``,
      },
      body: JSON.stringify(requestBody),
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  // Convert base64 audio content to blob
  const audioContent = data.audioContent;
  const byteCharacters = atob(audioContent);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "audio/mp3" });

  // Create audio URL and play it
  const audioUrl = URL.createObjectURL(blob);
  const audio = new Audio(audioUrl);

  audio.onended = () => {
    URL.revokeObjectURL(audioUrl);
  };

  audio.onerror = (error) => {
    URL.revokeObjectURL(audioUrl);
  };

  await audio.play();
};
