import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

export function createPageCurlMaterial({ frontTexture, backTexture, pageWidth, lift = 0.15 }) {
  const uniforms = {
    mapFront: { value: frontTexture },
    mapBack: { value: backTexture },
    uCurl: { value: 0.0 },
    uDirection: { value: 1.0 },
    uHingeX: { value: -pageWidth / 2 },
    uPageWidth: { value: pageWidth },
    uLift: { value: lift },
    uAmbient: { value: 0.35 },
    uLightDir: { value: new THREE.Vector3(-0.35, 0.6, 0.55).normalize() },
    uSpecularStrength: { value: 0.45 },
    uShadowStrength: { value: 0.4 },
  };

  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying float vCrease;
    uniform float uCurl;
    uniform float uDirection;
    uniform float uHingeX;
    uniform float uPageWidth;
    uniform float uLift;

    void main() {
      vUv = uv;
      float dir = uDirection;
      float hinge = uHingeX;
      float localX = (position.x - hinge) * dir;
      float clamped = clamp(localX / uPageWidth + 1.0e-5, 0.0, 1.0);
      float curlAmount = clamp(uCurl, 0.0, 1.0);
      float angle = curlAmount * 3.14159265 * 1.1;
      float theta = angle * pow(clamped, 0.75);
      float s = sin(theta);
      float c = cos(theta);

      vec3 pos = position;
      if (curlAmount > 0.0001) {
        pos.x = hinge + dir * (localX * c);
        pos.z += dir * (localX * s * 0.85 + curlAmount * 0.05);
        pos.y += sin(theta) * uLift * (1.0 - clamped);
      }

      vec3 transformedNormal = normal;
      if (curlAmount > 0.0001) {
        mat3 rot = mat3(
          c, 0.0, -dir * s,
          0.0, 1.0, 0.0,
          dir * s, 0.0, c
        );
        transformedNormal = rot * normal;
      }

      vNormal = normalize(normalMatrix * transformedNormal);
      vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
      vViewDir = cameraPosition - worldPosition.xyz;
      vCrease = 1.0 - clamped;

      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `;

  const fragmentShader = `
    precision mediump float;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying float vCrease;
    uniform sampler2D mapFront;
    uniform sampler2D mapBack;
    uniform float uCurl;
    uniform float uDirection;
    uniform float uAmbient;
    uniform vec3 uLightDir;
    uniform float uSpecularStrength;
    uniform float uShadowStrength;

    void main() {
      vec3 N = normalize(vNormal);
      vec3 L = normalize(uLightDir);
      vec3 V = normalize(vViewDir);
      vec2 uvFront = vUv;
      vec2 uvBack = vec2(1.0 - vUv.x, vUv.y);

      vec4 tex = gl_FrontFacing ? texture2D(mapFront, uvFront) : texture2D(mapBack, uvBack);
      float diffuse = max(dot(N, L), 0.0);
      vec3 halfVec = normalize(L + V);
      float specular = pow(max(dot(N, halfVec), 0.0), 24.0) * uSpecularStrength;
      float lighting = uAmbient + diffuse * (1.0 - uAmbient) + specular;
      float creaseShadow = mix(1.0, 1.0 - uShadowStrength, clamp(uCurl * (1.0 - vCrease), 0.0, 1.0));
      vec3 color = tex.rgb * lighting * creaseShadow;

      gl_FragColor = vec4(color, tex.a);
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
    transparent: true,
  });

  material.updateTextures = (front, back) => {
    material.uniforms.mapFront.value = front;
    material.uniforms.mapBack.value = back;
    material.uniformsNeedUpdate = true;
  };

  return material;
}
