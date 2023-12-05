function readAudioFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      resolve(event.target.result);
    };

    reader.onerror = (error) => {
      console.error("Error reading file:", error);
      reject(error);
    };

    reader.readAsArrayBuffer(file);
  });
}

async function init() {
  const audioContext = new AudioContext();
  const resultsContainer = document.getElementById("recognition-result");
  const partialContainer = document.getElementById("partial");

  partialContainer.textContent = "Loading...";

  const channel = new MessageChannel();
  const model = await Vosk.createModel("model.tar.gz");
  model.registerPort(channel.port1);

  const sampleRate = 48000;

  const recognizer = new model.KaldiRecognizer(sampleRate);
  recognizer.setWords(true);

  recognizer.on("result", (message) => {
    const result = message.result;

    const newSpan = document.createElement("span");
    newSpan.textContent = `${result.text} `;
    resultsContainer.insertBefore(newSpan, partialContainer);
  });
  recognizer.on("partialresult", (message) => {
    const partial = message.result.partial;

    partialContainer.textContent = partial;
  });

  partialContainer.textContent = "Ready";

  // Load an audio file (replace 'path/to/your/audio/file.wav' with the actual path)

  //   const audioFilePath = "audio.wav";
  //   const audioBuffer = await loadAudioFile(audioFilePath, sampleRate);
  const audioFileInput = document.getElementById("audioFileInput");
  const audioFile = audioFileInput.files[0];
  console.log("AudioFile: ", audioFile);
  const arrayBuffer = await readAudioFile(audioFile);
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  await audioContext.audioWorklet.addModule("recognizer-processor.js");
  const recognizerProcessor = new AudioWorkletNode(
    audioContext,
    "recognizer-processor",
    { channelCount: 1, numberOfInputs: 1, numberOfOutputs: 1 }
  );
  recognizerProcessor.port.postMessage(
    { action: "init", recognizerId: recognizer.id },
    [channel.port2]
  );
  recognizerProcessor.connect(audioContext.destination);

  // Use AudioBufferSourceNode instead of MediaStreamSourceNode
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(recognizerProcessor);

  source.start();
}

async function loadAudioFile(path, sampleRate) {
  const response = await fetch(path);
  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new AudioContext();
  return await audioContext.decodeAudioData(arrayBuffer);
}

window.onload = () => {
  const trigger = document.getElementById("trigger");
  trigger.onmouseup = () => {
    trigger.disabled = true;
    init();
  };
};
