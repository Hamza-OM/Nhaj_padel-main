import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const fragmentShader = `
precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;
    vec2 center = uv - 0.5;
    center.x *= u_resolution.x / u_resolution.y;

    // Create multiple flowing "energy" waves
    float noise = 0.0;
    for(float i = 1.0; i < 4.0; i++) {
        noise += sin(uv.x * 3.0 * i + u_time * 0.5 * i) * cos(uv.y * 2.0 * i - u_time * 0.3 * i);
    }

    // Core color palette from the design system
    vec3 color_bg = vec3(0.043, 0.075, 0.149); // #0b1326
    vec3 color_accent = vec3(0.765, 0.957, 0.0); // #c3f400

    // Interaction with mouse
    vec2 mouse_uv = u_mouse / u_resolution;
    float dist = distance(uv, mouse_uv);
    float glow = 0.05 / (dist + 0.1);

    // Blend colors based on noise and glow
    float alpha = smoothstep(0.3, 0.7, abs(noise) * 0.2);
    vec3 final_color = mix(color_bg, color_accent, alpha * 0.15);
    final_color += color_accent * glow * 0.2;

    gl_FragColor = vec4(final_color, 1.0);
}
`;

const vertexShader = `
varying vec2 v_texCoord;
void main() {
    v_texCoord = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Full-viewport, mouse-reactive energy-wave shader background from the
 * "Riverside Padel" Stitch design spec. Mounted once at the app root, fixed
 * behind all content. Respects prefers-reduced-motion by rendering a single
 * static frame instead of a continuous animation loop.
 */
export const WebGLBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms = {
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2() },
      u_mouse: { value: new THREE.Vector2(0.5, 0.5) }
    };

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({ fragmentShader, vertexShader, uniforms });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer.setSize(width, height);
      uniforms.u_resolution.value.set(width, height);
    };

    const handleMouseMove = (e: MouseEvent) => {
      uniforms.u_mouse.value.set(e.clientX, window.innerHeight - e.clientY);
    };

    resize();
    window.addEventListener('resize', resize);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId: number | null = null;

    if (prefersReducedMotion) {
      renderer.render(scene, camera);
    } else {
      window.addEventListener('mousemove', handleMouseMove);
      const animate = (time: number) => {
        uniforms.u_time.value = time * 0.001;
        renderer.render(scene, camera);
        rafId = requestAnimationFrame(animate);
      };
      rafId = requestAnimationFrame(animate);
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-screen h-screen -z-10 pointer-events-none"
    />
  );
};
