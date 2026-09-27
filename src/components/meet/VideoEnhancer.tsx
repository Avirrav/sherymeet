"use client";

import { useEffect, useRef, useCallback } from "react";
import { Track } from "livekit-client";

interface VideoEnhancerProps {
  videoTrack: Track | null;
  isLocal?: boolean;
  className?: string;
  enabled?: boolean;
  sharpness?: number; // 0.0 to 2.0, default 0.5
  clarity?: number; // 0.0 to 1.0, default 0.3
}

const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  uniform float u_flipX;

  void main() {
    vec2 pos = a_position;
    if (u_flipX > 0.5) {
      pos.x = -pos.x;
    }
    gl_Position = vec4(pos, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;

  uniform sampler2D u_texture;
  uniform vec2 u_textureSize;
  uniform float u_sharpness;
  uniform float u_clarity;

  varying vec2 v_texCoord;

  void main() {
    vec2 texel = 1.0 / u_textureSize;

    // Sample center and neighbors for sharpening
    vec4 center = texture2D(u_texture, v_texCoord);
    vec4 top = texture2D(u_texture, v_texCoord + vec2(0.0, -texel.y));
    vec4 bottom = texture2D(u_texture, v_texCoord + vec2(0.0, texel.y));
    vec4 left = texture2D(u_texture, v_texCoord + vec2(-texel.x, 0.0));
    vec4 right = texture2D(u_texture, v_texCoord + vec2(texel.x, 0.0));

    // Unsharp mask sharpening
    vec4 blur = (top + bottom + left + right) * 0.25;
    vec4 sharpened = center + (center - blur) * u_sharpness;

    // Clarity enhancement (local contrast)
    vec4 topLeft = texture2D(u_texture, v_texCoord + vec2(-texel.x, -texel.y));
    vec4 topRight = texture2D(u_texture, v_texCoord + vec2(texel.x, -texel.y));
    vec4 bottomLeft = texture2D(u_texture, v_texCoord + vec2(-texel.x, texel.y));
    vec4 bottomRight = texture2D(u_texture, v_texCoord + vec2(texel.x, texel.y));

    vec4 localAvg = (top + bottom + left + right + topLeft + topRight + bottomLeft + bottomRight) / 8.0;
    float localContrast = length(center.rgb - localAvg.rgb);
    vec4 clarified = sharpened + (sharpened - localAvg) * u_clarity * (1.0 - localContrast);

    // Clamp to valid range
    gl_FragColor = clamp(clarified, 0.0, 1.0);
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

export default function VideoEnhancer({
  videoTrack,
  isLocal = false,
  className = "",
  enabled = true,
  sharpness = 0.5,
  clarity = 0.3,
}: VideoEnhancerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const textureRef = useRef<WebGLTexture | null>(null);
  const rafRef = useRef<number>(0);
  const locationsRef = useRef<{
    position: number;
    texCoord: number;
    texture: WebGLUniformLocation | null;
    textureSize: WebGLUniformLocation | null;
    sharpness: WebGLUniformLocation | null;
    clarity: WebGLUniformLocation | null;
    flipX: WebGLUniformLocation | null;
  } | null>(null);

  // Initialize WebGL
  const initWebGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      console.error("WebGL not supported");
      return false;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return false;

    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) return false;

    // Get attribute and uniform locations
    const positionLoc = gl.getAttribLocation(program, "a_position");
    const texCoordLoc = gl.getAttribLocation(program, "a_texCoord");
    const textureLoc = gl.getUniformLocation(program, "u_texture");
    const textureSizeLoc = gl.getUniformLocation(program, "u_textureSize");
    const sharpnessLoc = gl.getUniformLocation(program, "u_sharpness");
    const clarityLoc = gl.getUniformLocation(program, "u_clarity");
    const flipXLoc = gl.getUniformLocation(program, "u_flipX");

    // Create buffers
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]),
      gl.STATIC_DRAW,
    );

    // Create texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Store references
    glRef.current = gl;
    programRef.current = program;
    textureRef.current = texture;
    locationsRef.current = {
      position: positionLoc,
      texCoord: texCoordLoc,
      texture: textureLoc,
      textureSize: textureSizeLoc,
      sharpness: sharpnessLoc,
      clarity: clarityLoc,
      flipX: flipXLoc,
    };

    // Setup VAO-like state
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.enableVertexAttribArray(texCoordLoc);
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

    return true;
  }, []);

  // Store render params in refs for the render loop
  const paramsRef = useRef({ sharpness, clarity, isLocal });
  useEffect(() => {
    paramsRef.current = { sharpness, clarity, isLocal };
  }, [sharpness, clarity, isLocal]);

  // Start render loop
  const startRenderLoop = useCallback(() => {
    const render = () => {
      const gl = glRef.current;
      const video = videoRef.current;
      const program = programRef.current;
      const texture = textureRef.current;
      const locations = locationsRef.current;
      const canvas = canvasRef.current;
      const params = paramsRef.current;

      if (!gl || !video || !program || !texture || !locations || !canvas) {
        rafRef.current = requestAnimationFrame(render);
        return;
      }

      if (video.readyState < 2) {
        rafRef.current = requestAnimationFrame(render);
        return;
      }

      // Update canvas size if needed
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }

      // Update texture with video frame
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

      // Set uniforms
      gl.uniform1i(locations.texture, 0);
      gl.uniform2f(locations.textureSize, video.videoWidth || 640, video.videoHeight || 480);
      gl.uniform1f(locations.sharpness, params.sharpness);
      gl.uniform1f(locations.clarity, params.clarity);
      gl.uniform1f(locations.flipX, params.isLocal ? 1.0 : 0.0);

      // Draw
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
  }, []);

  // Setup video element and attach track
  useEffect(() => {
    if (!videoTrack) {
      return;
    }

    // Create hidden video element
    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.style.display = "none";
    document.body.appendChild(video);

    videoTrack.attach(video);
    videoRef.current = video;

    return () => {
      videoTrack.detach(video);
      video.remove();
      videoRef.current = null;
    };
  }, [videoTrack]);

  // Initialize WebGL and start rendering
  useEffect(() => {
    if (!enabled || !videoTrack) return;

    const initialized = initWebGL();
    if (!initialized) return;

    startRenderLoop();

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, videoTrack, initWebGL, startRenderLoop]);

  // Cleanup WebGL resources
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      const gl = glRef.current;
      if (gl) {
        if (textureRef.current) gl.deleteTexture(textureRef.current);
        if (programRef.current) gl.deleteProgram(programRef.current);
      }
    };
  }, []);

  if (!enabled || !videoTrack) {
    return null;
  }

  return <canvas ref={canvasRef} className={`w-full h-full object-cover ${className}`} />;
}
