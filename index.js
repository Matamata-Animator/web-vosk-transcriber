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
let lastUpdated = Date.now();
let started = false;
async function init() {
  const audioContext = new AudioContext();
  const resultsContainer = document.getElementById("recognition-result");
  const partialContainer = document.getElementById("partial");

  partialContainer.textContent = "Loading...";

  const channel = new MessageChannel();
  const model = await Vosk.createModel(window.location.href + "model.tar.gz");
  model.registerPort(channel.port1);

  const sampleRate = 48000;

  const recognizer = new model.KaldiRecognizer(sampleRate);
  recognizer.setWords(true);

  recognizer.on("result", async (message) => {
    console.log(message);
    lastUpdated = Date.now();

    const result = message.result;

    const newSpan = document.createElement("span");
    newSpan.textContent = `${result.text} `;
    resultsContainer.insertBefore(newSpan, partialContainer);
    console.log("Done");
    console.log(message);
  });
  recognizer.on("partialresult", (message) => {
    const partial = message.result.partial;

    partialContainer.textContent = partial;
    lastUpdated = Date.now();
    started = true;
  });

  partialContainer.textContent = "Ready";

  //   const audioFileInput = document.getElementById("audioFileInput");
  //   const audioFile = audioFileInput.files[0];
  //   console.log("AudioFile: ", audioFile);
  //   const arrayBuffer = await readAudioFile(audioFile);
  //   console.log(arrayBuffer);
  const arrayBuffer = await (
    await fetch("http://localhost:8000/audio_file")
  ).arrayBuffer();
  console.log(arrayBuffer);
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

window.onload = () => {
  const trigger = document.getElementById("trigger");
  trigger.onmouseup = async () => {
    trigger.disabled = true;
    if (!started) {
      init();
    }
  };

  init();
};

async function checkTimer() {
  if (started && Date.now() - lastUpdated > 500) {
    result = document.getElementById("recognition-result").innerText;
    console.log(result);
    await fetch(`http://localhost:8000/transcriber_result?text=${result}`);
    window.close();
  } else {
    setTimeout(await checkTimer, 500);
  }
}

checkTimer();
