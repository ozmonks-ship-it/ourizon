export const LOADING_ANIMATION_STYLES = `
  @keyframes ourizon-arc-draw {
    from { stroke-dashoffset: 42; }
    to   { stroke-dashoffset: 0; }
  }
  @keyframes ourizon-horizon {
    from { opacity: 0; transform: scaleX(0.3); }
    to   { opacity: 0.5; transform: scaleX(1); }
  }
  @keyframes ourizon-dot-pop {
    0%   { transform: scale(0); opacity: 0; }
    60%  { transform: scale(1.35); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes ourizon-ray {
    from { opacity: 0; transform: scale(0.5); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes ourizon-wordmark {
    from { opacity: 0; letter-spacing: 0.18em; }
    to   { opacity: 1; letter-spacing: 0.04em; }
  }
  @keyframes ourizon-tagline {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 0.5; transform: translateY(0); }
  }
  @keyframes ourizon-bar {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }

  .arc-animate {
    stroke-dasharray: 42;
    stroke-dashoffset: 42;
    animation: ourizon-arc-draw 0.7s cubic-bezier(0.4, 0, 0.2, 1) 0.3s forwards;
  }
  .horizon-animate {
    transform-origin: center;
    animation: ourizon-horizon 0.5s ease-out 0.15s both;
  }
  .dot-animate {
    transform-origin: 24px 31px;
    animation: ourizon-dot-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 0.85s both;
  }
  .ray-1 { animation: ourizon-ray 0.3s ease-out 1.0s both; transform-origin: 24px 13.5px; }
  .ray-2 { animation: ourizon-ray 0.3s ease-out 1.1s both; transform-origin: 14px 18px; }
  .ray-3 { animation: ourizon-ray 0.3s ease-out 1.15s both; transform-origin: 34px 18px; }
  .ray-4 { animation: ourizon-ray 0.3s ease-out 1.2s both; transform-origin: 9.25px 24.15px; }
  .ray-5 { animation: ourizon-ray 0.3s ease-out 1.25s both; transform-origin: 38.75px 24.15px; }
  .wordmark-animate {
    animation: ourizon-wordmark 0.6s ease-out 1.1s both;
  }
  .tagline-animate {
    animation: ourizon-tagline 0.5s ease-out 1.4s both;
  }
  .bar-animate {
    transform-origin: left;
    animation: ourizon-bar 1.6s cubic-bezier(0.4, 0, 0.2, 1) 0.2s both;
  }
`;
