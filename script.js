const fileInput = document.getElementById("fileInput");
const sourceCanvas = document.getElementById("sourceCanvas");
const resultCanvas = document.getElementById("resultCanvas");
const methodRadios = document.querySelectorAll('input[name="method"]');
const thresholdRange = document.getElementById("thresholdRange");
const thresholdValue = document.getElementById("thresholdValue");
const sliderWrap = document.getElementById("sliderWrap");
const infoText = document.getElementById("infoText");
const downloadBtn = document.getElementById("downloadBtn");

const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
const resultCtx = resultCanvas.getContext("2d", { willReadFrequently: true });

let sourceImageData = null;

function getSelectedMethod() {
  return document.querySelector('input[name="method"]:checked').value;
}

function setCanvasSize(width, height) {
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  resultCanvas.width = width;
  resultCanvas.height = height;
}

function toGray(r, g, b) {
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

function computeOtsuThreshold(grayValues) {
  const histogram = new Array(256).fill(0);

  for (let i = 0; i < grayValues.length; i += 1) {
    histogram[grayValues[i]] += 1;
  }

  const total = grayValues.length;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) {
    sum += i * histogram[i];
  }

  let sumBackground = 0;
  let weightBackground = 0;
  let maxVariance = -1;
  let threshold = 0;

  for (let t = 0; t < 256; t += 1) {
    weightBackground += histogram[t];
    if (weightBackground === 0) {
      continue;
    }

    const weightForeground = total - weightBackground;
    if (weightForeground === 0) {
      break;
    }

    sumBackground += t * histogram[t];

    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const betweenClassVariance =
      weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

    if (betweenClassVariance > maxVariance) {
      maxVariance = betweenClassVariance;
      threshold = t;
    }
  }

  return threshold;
}

function binarize() {
  if (!sourceImageData) {
    return;
  }

  const data = sourceImageData.data;
  const result = resultCtx.createImageData(sourceImageData.width, sourceImageData.height);
  const out = result.data;
  const grayValues = new Uint8Array(sourceImageData.width * sourceImageData.height);

  let grayIndex = 0;
  for (let i = 0; i < data.length; i += 4) {
    grayValues[grayIndex] = toGray(data[i], data[i + 1], data[i + 2]);
    grayIndex += 1;
  }

  let threshold = Number(thresholdRange.value);
  const method = getSelectedMethod();

  if (method === "otsu") {
    threshold = computeOtsuThreshold(grayValues);
    thresholdRange.value = String(threshold);
  }

  thresholdValue.textContent = String(threshold);

  let pixelIndex = 0;
  for (let i = 0; i < out.length; i += 4) {
    const binary = grayValues[pixelIndex] >= threshold ? 255 : 0;
    out[i] = binary;
    out[i + 1] = binary;
    out[i + 2] = binary;
    out[i + 3] = 255;
    pixelIndex += 1;
  }

  resultCtx.putImageData(result, 0, 0);
  infoText.textContent = `Метод: ${method === "otsu" ? "Otsu" : "Ручной"}. Используемый порог: ${threshold}`;
  downloadBtn.disabled = false;
}

function updateSliderVisibility() {
  const method = getSelectedMethod();
  sliderWrap.style.opacity = method === "manual" ? "1" : "0.55";
  thresholdRange.disabled = method !== "manual";
}

function loadImage(file) {
  const image = new Image();
  const reader = new FileReader();

  reader.onload = () => {
    image.onload = () => {
      const maxDimension = 1200;
      const ratio = Math.min(maxDimension / image.width, maxDimension / image.height, 1);
      const width = Math.max(1, Math.round(image.width * ratio));
      const height = Math.max(1, Math.round(image.height * ratio));

      setCanvasSize(width, height);
      sourceCtx.clearRect(0, 0, width, height);
      resultCtx.clearRect(0, 0, width, height);
      sourceCtx.drawImage(image, 0, 0, width, height);
      sourceImageData = sourceCtx.getImageData(0, 0, width, height);
      binarize();
    };

    image.src = reader.result;
  };

  reader.readAsDataURL(file);
}

fileInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  loadImage(file);
});

methodRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    updateSliderVisibility();
    binarize();
  });
});

thresholdRange.addEventListener("input", () => {
  thresholdValue.textContent = thresholdRange.value;
  if (getSelectedMethod() === "manual") {
    binarize();
  }
});

downloadBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "binarized.png";
  link.href = resultCanvas.toDataURL("image/png");
  link.click();
});

updateSliderVisibility();
