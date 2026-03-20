'use client';
import { cn } from '@/lib/utils';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

type DottedSurfaceProps = Omit<React.ComponentProps<'div'>, 'ref'>;

export function DottedSurface({ className, ...props }: DottedSurfaceProps) {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!containerRef.current) return;
		const container = containerRef.current;
		const rect = container.getBoundingClientRect();

		const SEPARATION = 100;
		const AMOUNTX = 50;
		const AMOUNTY = 30;

		const scene = new THREE.Scene();

		const camera = new THREE.PerspectiveCamera(
			75,
			rect.width / rect.height,
			1,
			10000,
		);
		camera.position.set(0, 350, 1100);
		camera.lookAt(0, 0, 200);

		const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(rect.width, rect.height);
		renderer.setClearColor(0x000000, 0);
		container.appendChild(renderer.domElement);

		const positions: number[] = [];
		const colors: number[] = [];
		const geometry = new THREE.BufferGeometry();

		for (let ix = 0; ix < AMOUNTX; ix++) {
			for (let iy = 0; iy < AMOUNTY; iy++) {
				const x = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
				const z = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2;
				positions.push(x, 0, z);
				colors.push(0.85, 0.55, 0.3);
			}
		}

		geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
		geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

		const material = new THREE.PointsMaterial({
			size: 8,
			vertexColors: true,
			transparent: true,
			opacity: 0.6,
			sizeAttenuation: true,
		});

		const points = new THREE.Points(geometry, material);
		scene.add(points);

		let count = 0;
		let animationId: number;

		const animate = () => {
			animationId = requestAnimationFrame(animate);
			const posAttr = geometry.attributes.position;
			const pos = posAttr.array as Float32Array;

			let i = 0;
			for (let ix = 0; ix < AMOUNTX; ix++) {
				for (let iy = 0; iy < AMOUNTY; iy++) {
					pos[i * 3 + 1] =
						Math.sin((ix + count) * 0.3) * 40 +
						Math.sin((iy + count) * 0.5) * 40;
					i++;
				}
			}
			posAttr.needsUpdate = true;
			renderer.render(scene, camera);
			count += 0.06;
		};

		const handleResize = () => {
			const r = container.getBoundingClientRect();
			camera.aspect = r.width / r.height;
			camera.updateProjectionMatrix();
			renderer.setSize(r.width, r.height);
		};

		window.addEventListener('resize', handleResize);
		animate();

		const cleanup = { animationId: 0 };

		return () => {
			window.removeEventListener('resize', handleResize);
			cancelAnimationFrame(animationId);
			scene.traverse((object) => {
				if (object instanceof THREE.Points) {
					object.geometry.dispose();
					(object.material as THREE.Material).dispose();
				}
			});
			renderer.dispose();
			if (container.contains(renderer.domElement)) {
				container.removeChild(renderer.domElement);
			}
		};
	}, []);

	return (
		<div
			ref={containerRef}
			className={cn('pointer-events-none absolute inset-0 z-0 overflow-hidden', className)}
			{...props}
		/>
	);
}
