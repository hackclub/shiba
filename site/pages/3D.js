import * as THREE from 'three';
import React from 'react';
import { createRoot } from 'react-dom/client';

// OBJ Loader for loading .obj files
const OBJLoader = (() => {
  // Simple OBJ loader implementation
  return {
    load: (url, onLoad, onProgress, onError) => {
      fetch(url)
        .then(response => response.text())
        .then(text => {
          const lines = text.split('\n');
          const vertices = [];
          const faces = [];
          
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts[0] === 'v') {
              vertices.push([
                parseFloat(parts[1]),
                parseFloat(parts[2]),
                parseFloat(parts[3])
              ]);
            } else if (parts[0] === 'f') {
              const face = [];
              for (let i = 1; i < parts.length; i++) {
                const vertexIndex = parseInt(parts[i].split('/')[0]) - 1;
                face.push(vertexIndex);
              }
              faces.push(face);
            }
          }
          
          const geometry = new THREE.BufferGeometry();
          const positions = [];
          const indices = [];
          
          for (const face of faces) {
            for (let i = 1; i < face.length - 1; i++) {
              indices.push(face[0], face[i], face[i + 1]);
            }
          }
          
          for (const index of indices) {
            if (vertices[index]) {
              positions.push(vertices[index][0], vertices[index][1], vertices[index][2]);
            }
          }
          
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
          geometry.computeVertexNormals();
          
          onLoad(geometry);
        })
        .catch(onError);
    }
  };
})();

export default function ThreeDPage({ games: prefetchedGames = [], gamesError = null }) {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <div 
        style={{ width: '100%', height: '100%' }}
        ref={(el) => {
          if (!el) return;
          
          // Log game data on refresh
          console.log('🎮 3D Page - Game Data:', {
            games: prefetchedGames,
            gamesCount: prefetchedGames?.length || 0,
            gamesError: gamesError,
            timestamp: new Date().toISOString()
          });
          
          // Create scene
          const scene = new THREE.Scene();
          const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
          const renderer = new THREE.WebGLRenderer();
          
          renderer.setSize(window.innerWidth, window.innerHeight);
          el.appendChild(renderer.domElement);

          // Moderate ambient lighting
          const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
          scene.add(ambientLight);
          
          // Weak directional light
          const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
          directionalLight.position.set(10, 10, 5);
          scene.add(directionalLight);
          
          // Moderate hemisphere light
          const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0xC6AE8D, 0.3);
          scene.add(hemisphereLight);

          // Calculate room size to fit all games
          const totalGames = (prefetchedGames || []).length;
          const gamesPerAisle = 10; // Games per aisle
          const aisleSpacing = 1.5; // Space between aisles
          const aisleWidth = 4.0; // Width of each aisle
          const requiredAisles = Math.ceil(totalGames / gamesPerAisle);
          const endPadding = 3.0; // Big space at both ends of the room
          const totalPadding = endPadding * 2; // Padding on both ends
          const requiredDepth = (requiredAisles * aisleSpacing) + 2 + totalPadding; // Add padding on both ends
          const requiredWidth = aisleWidth + 1; // Add padding for walls
          
          // Room configuration - dynamic based on game count
          const roomConfig = {
            width: Math.max(requiredWidth, 5), // At least 5 units wide
            height: 2.0, // Increased height to accommodate vaulted ceiling
            depth: Math.max(requiredDepth, 5), // At least 5 units deep
            wallThickness: 0.2,
            wallColor: 0xC6AE8D, // Warm beige/tan
            floorColor: 0x808080, // Gray
            ceilingColor: 0xF5F5DC, // Beige
            lightSpacing: 4, // Distance between lights
            lightIntensity: 0.4,
            lightColor: 0xffffff
          };

          // Create vaulted ceiling like Mill Valley Library
          function createVaultedCeiling(config) {
            const ceilingGroup = new THREE.Group();
            
            // Ceiling height and arch parameters
            const baseHeight = config.height;
            const archHeight = 1.5; // Reduced height for better visibility
            const peakHeight = baseHeight + archHeight;
            const beamThickness = 0.15; // Thicker beams for better visibility
            const panelThickness = 0.05;
            
            // Materials with better visibility
            const beamMaterial = new THREE.MeshLambertMaterial({ 
              color: 0x4A2C17, // Lighter brown for better visibility
              emissive: 0x1A0F0A, // Subtle glow
              emissiveIntensity: 0.2
            });
            const panelMaterial = new THREE.MeshLambertMaterial({ 
              color: 0xA0522D, // Lighter reddish-brown
              emissive: 0x2A1A0F, // Subtle glow
              emissiveIntensity: 0.1
            });
            
            // Create flat ceiling panels instead of arch
            const panelSpacing = 1.5;
            const numPanelsX = Math.floor(config.width / panelSpacing);
            const numPanelsZ = Math.floor(config.depth / panelSpacing);
            
            for (let x = 0; x < numPanelsX; x++) {
              for (let z = 0; z < numPanelsZ; z++) {
                const panelX = -config.width / 2 + (x + 0.5) * (config.width / numPanelsX);
                const panelZ = -config.depth / 2 + (z + 0.5) * (config.depth / numPanelsZ);
                
                const panelGeometry = new THREE.PlaneGeometry(
                  config.width / numPanelsX - 0.1,
                  config.depth / numPanelsZ - 0.1
                );
                const panel = new THREE.Mesh(panelGeometry, panelMaterial);
                panel.rotation.x = -Math.PI / 2;
                panel.position.set(panelX, baseHeight + archHeight * 0.8, panelZ);
                ceilingGroup.add(panel);
              }
            }
            
            // Create exposed wooden beams
            const beamSpacing = 2.0;
            const numBeams = Math.floor(config.depth / beamSpacing);
            
            for (let i = 0; i <= numBeams; i++) {
              const z = -config.depth / 2 + (i * config.depth / numBeams);
              
              // Horizontal beam
              const beamGeometry = new THREE.BoxGeometry(config.width, beamThickness, beamThickness);
              const beam = new THREE.Mesh(beamGeometry, beamMaterial);
              beam.position.set(0, baseHeight + archHeight * 0.7, z);
              ceilingGroup.add(beam);
              
              // Vertical support beams
              const supportGeometry = new THREE.BoxGeometry(beamThickness, archHeight * 0.8, beamThickness);
              const leftSupport = new THREE.Mesh(supportGeometry, beamMaterial);
              leftSupport.position.set(-config.width / 2 + beamThickness / 2, baseHeight + archHeight * 0.4, z);
              ceilingGroup.add(leftSupport);
              
              const rightSupport = new THREE.Mesh(supportGeometry, beamMaterial);
              rightSupport.position.set(config.width / 2 - beamThickness / 2, baseHeight + archHeight * 0.4, z);
              ceilingGroup.add(rightSupport);
            }
            
            // Create diagonal cross beams
            const crossBeamSpacing = 4.0;
            const numCrossBeams = Math.floor(config.width / crossBeamSpacing);
            
            for (let i = 1; i < numCrossBeams; i++) {
              const x = -config.width / 2 + (i * config.width / numCrossBeams);
              
              // Diagonal beam from left to right
              const crossBeamGeometry = new THREE.BoxGeometry(beamThickness, beamThickness, config.depth * 0.8);
              const crossBeam = new THREE.Mesh(crossBeamGeometry, beamMaterial);
              crossBeam.position.set(x, baseHeight + archHeight * 0.6, 0);
              crossBeam.rotation.y = Math.PI / 4;
              ceilingGroup.add(crossBeam);
            }
            
            // Add pendant lights hanging from beams
            const lightSpacing = 3.0;
            const numLightsX = Math.floor(config.width / lightSpacing);
            const numLightsZ = Math.floor(config.depth / lightSpacing);
            
            for (let x = 0; x < numLightsX; x++) {
              for (let z = 0; z < numLightsZ; z++) {
                const lightX = -config.width / 2 + (x + 0.5) * (config.width / numLightsX);
                const lightZ = -config.depth / 2 + (z + 0.5) * (config.depth / numLightsZ);
                
                // Pendant light fixture
                const lightGeometry = new THREE.SphereGeometry(0.25, 16, 16);
                const lightMaterial = new THREE.MeshBasicMaterial({ 
                  color: 0xffffff,
                  emissive: 0x666666,
                  emissiveIntensity: 0.6
                });
                const pendantLight = new THREE.Mesh(lightGeometry, lightMaterial);
                pendantLight.position.set(lightX, baseHeight + archHeight * 0.3, lightZ);
                ceilingGroup.add(pendantLight);
                
                // Add actual light source
                const pointLight = new THREE.PointLight(0xffffff, 0.8, 8);
                pointLight.position.set(lightX, baseHeight + archHeight * 0.3, lightZ);
                ceilingGroup.add(pointLight);
                
                // Light chain/cord
                const chainGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.5);
                const chainMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
                const chain = new THREE.Mesh(chainGeometry, chainMaterial);
                chain.position.set(lightX, baseHeight + archHeight * 0.55, lightZ);
                ceilingGroup.add(chain);
              }
            }
            
            return ceilingGroup;
          }

          // Create room programmatically
          function createRoom(config) {
            const room = new THREE.Group();
            
            // Floor with texture
            const floorGeometry = new THREE.PlaneGeometry(config.width, config.depth);
            const floorTexture = new THREE.TextureLoader().load('/floor.png');
            floorTexture.wrapS = THREE.RepeatWrapping;
            floorTexture.wrapT = THREE.RepeatWrapping;
            floorTexture.magFilter = THREE.NearestFilter; // Pixelated stretching
            floorTexture.minFilter = THREE.NearestFilter; // Pixelated stretching
            floorTexture.repeat.set(config.width, config.depth); // Stretch to fit room
            const floorMaterial = new THREE.MeshLambertMaterial({ map: floorTexture });
            const floor = new THREE.Mesh(floorGeometry, floorMaterial);
            floor.rotation.x = -Math.PI / 2;
            floor.position.y = 0;
            room.add(floor);
            
            // Vaulted ceiling like Mill Valley Library
            const vaultedCeiling = createVaultedCeiling(config);
            room.add(vaultedCeiling);
            
            // Walls
            const wallMaterial = new THREE.MeshLambertMaterial({ color: config.wallColor });
            
            // Front wall - thin 3D box
            const frontWallGeometry = new THREE.BoxGeometry(config.width, config.height, 0.01);
            const frontWall = new THREE.Mesh(frontWallGeometry, wallMaterial);
            frontWall.position.set(0, config.height / 2, config.depth / 2);
            room.add(frontWall);
            
            // Back wall - thin 3D box
            const backWallGeometry = new THREE.BoxGeometry(config.width, config.height, 0.01);
            const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
            backWall.position.set(0, config.height / 2, -config.depth / 2);
            room.add(backWall);
            
            // Left wall - thin 3D box
            const leftWallGeometry = new THREE.BoxGeometry(0.01, config.height, config.depth);
            const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
            leftWall.position.set(-config.width / 2, config.height / 2, 0);
            room.add(leftWall);
            
            // Right wall - thin 3D box
            const rightWallGeometry = new THREE.BoxGeometry(0.01, config.height, config.depth);
            const rightWall = new THREE.Mesh(rightWallGeometry, wallMaterial);
            rightWall.position.set(config.width / 2, config.height / 2, 0);
            room.add(rightWall);
            
            // Add end space area (lobby) - create a visual indicator
            const endSpaceGeometry = new THREE.PlaneGeometry(config.width * 0.8, 2.0);
            const endSpaceMaterial = new THREE.MeshLambertMaterial({ 
              color: 0x444444, 
              transparent: true, 
              opacity: 0.3 
            });
            const endSpace = new THREE.Mesh(endSpaceGeometry, endSpaceMaterial);
            endSpace.rotation.x = -Math.PI / 2;
            endSpace.position.set(0, 0.01, config.depth / 2 - 1.5); // Position in the end space area
            room.add(endSpace);
            
            return room;
          }

          // Create automatic ceiling lights
          function createCeilingLights(config) {
            const lights = [];
            const startX = -config.width / 2 + config.lightSpacing / 2;
            const startZ = -config.depth / 2 + config.lightSpacing / 2;
            const endX = config.width / 2 - config.lightSpacing / 2;
            const endZ = config.depth / 2 - config.lightSpacing / 2;
            
            for (let x = startX; x <= endX; x += config.lightSpacing) {
              for (let z = startZ; z <= endZ; z += config.lightSpacing) {
                const light = new THREE.PointLight(config.lightColor, config.lightIntensity, 50);
                light.position.set(x, config.height - 0.1, z); // Just below ceiling
                lights.push(light);
              }
            }
            return lights;
          }

          // Add room to scene
          const room = createRoom(roomConfig);
          scene.add(room);

          // Add automatic ceiling lights
          const ceilingLights = createCeilingLights(roomConfig);
          ceilingLights.forEach(light => scene.add(light));

          // Add wall paintings
          const wallPaintings = createWallPaintings(roomConfig);
          wallPaintings.forEach(painting => scene.add(painting));

          // Create wall paintings function
          function createWallPaintings(config) {
            const paintings = [];
            
            // All available painting files
            const allPaintingFiles = [
              'alban.png', 'aztec.png', 'betray.png', 'bomb.png', 'bust.png', 'bust2.png',
              'courbet.png', 'creeper.png', 'diamond.png', 'donkey.png', 'earth.png',
              'fighters.png', 'fighters2.png', 'fire.png', 'graham.png', 'kebab.png',
              'kong.png', 'love.png', 'match.png', 'pigscene.png', 'plant.png',
              'pointer.png', 'pool.png', 'prize.png', 'sea.png', 'skeleton.png',
              'skull.png', 'stage.png', 'sunset.png', 'void.png', 'wanderer.png',
              'wasteland.png', 'water.png', 'wind.png', 'wither.png'
            ];
            
            // Shuffle the array to get random order
            const shuffledPaintings = [...allPaintingFiles].sort(() => Math.random() - 0.5);
            
            // Painting dimensions (1x1, 1x2, 2x1, 2x2 blocks)
            const paintingSizes = [
              { width: 1, height: 1 },
              { width: 1, height: 2 },
              { width: 2, height: 1 },
              { width: 2, height: 2 }
            ];
            
            // Simple approach - just place a few paintings on each wall
            const paintingsPerWall = 3;
            let paintingIndex = 0;
            
            // Front wall (back of room)
            for (let i = 0; i < paintingsPerWall; i++) {
              if (paintingIndex >= shuffledPaintings.length) break;
              
              const size = paintingSizes[Math.floor(Math.random() * paintingSizes.length)];
              const painting = createPainting(
                shuffledPaintings[paintingIndex],
                size,
                new THREE.Vector3(
                  -config.width/2 + (i + 1) * (config.width / (paintingsPerWall + 1)),
                  config.height/2, // Back to original height
                  -config.depth/2 + 0.02 // Just slightly off wall
                ),
                0 // No rotation for front wall
              );
              paintings.push(painting);
              paintingIndex++;
            }
            
            // Back wall (entrance)
            for (let i = 0; i < paintingsPerWall; i++) {
              if (paintingIndex >= shuffledPaintings.length) break;
              
              const size = paintingSizes[Math.floor(Math.random() * paintingSizes.length)];
              const painting = createPainting(
                shuffledPaintings[paintingIndex],
                size,
                new THREE.Vector3(
                  -config.width/2 + (i + 1) * (config.width / (paintingsPerWall + 1)),
                  config.height/2, // Back to original height
                  config.depth/2 - 0.02 // Just slightly off wall
                ),
                Math.PI // 180 degrees for back wall
              );
              paintings.push(painting);
              paintingIndex++;
            }
            
            // Left wall
            for (let i = 0; i < paintingsPerWall; i++) {
              if (paintingIndex >= shuffledPaintings.length) break;
              
              const size = paintingSizes[Math.floor(Math.random() * paintingSizes.length)];
              const painting = createPainting(
                shuffledPaintings[paintingIndex],
                size,
                new THREE.Vector3(
                  -config.width/2 + 0.02, // Just slightly off wall
                  config.height/2, // Back to original height
                  -config.depth/2 + (i + 1) * (config.depth / (paintingsPerWall + 1))
                ),
                Math.PI/2 // 90 degrees for left wall
              );
              paintings.push(painting);
              paintingIndex++;
            }
            
            // Right wall
            for (let i = 0; i < paintingsPerWall; i++) {
              if (paintingIndex >= shuffledPaintings.length) break;
              
              const size = paintingSizes[Math.floor(Math.random() * paintingSizes.length)];
              const painting = createPainting(
                shuffledPaintings[paintingIndex],
                size,
                new THREE.Vector3(
                  config.width/2 - 0.02, // Just slightly off wall
                  config.height/2, // Back to original height
                  -config.depth/2 + (i + 1) * (config.depth / (paintingsPerWall + 1))
                ),
                -Math.PI/2 // -90 degrees for right wall
              );
              paintings.push(painting);
              paintingIndex++;
            }
            
            console.log('Total paintings created:', paintings.length);
            return paintings;
          }
          
          // Calculate positions for paintings on a wall to avoid overlaps
          function calculateWallPositions(wallLength, minSpacing, direction) {
            const positions = [];
            const startPos = -wallLength/2 + 1; // Start 1 unit from edge
            const endPos = wallLength/2 - 1; // End 1 unit from edge
            const availableLength = endPos - startPos;
            
            // Calculate how many paintings we can fit
            const maxPaintings = Math.floor(availableLength / minSpacing);
            
            if (maxPaintings <= 0) return positions;
            
            // Distribute paintings evenly
            for (let i = 0; i < maxPaintings; i++) {
              const t = i / (maxPaintings - 1);
              const position = startPos + t * availableLength;
              positions.push(position);
            }
            
            return positions;
          }
          
          // Create individual painting
          function createPainting(filename, size, position, rotation) {
            const paintingGroup = new THREE.Group();
            paintingGroup.position.copy(position);
            paintingGroup.rotation.y = rotation;
            
            // Load painting texture
            const texture = new THREE.TextureLoader().load(`/minecraft-paintings/${filename}`);
            texture.magFilter = THREE.NearestFilter; // Pixelated look
            texture.minFilter = THREE.NearestFilter;
            
            // Create painting plane
            const paintingGeometry = new THREE.PlaneGeometry(size.width * 0.5, size.height * 0.5);
            const paintingMaterial = new THREE.MeshBasicMaterial({ 
              map: texture,
              transparent: true,
              side: THREE.DoubleSide
            });
            const painting = new THREE.Mesh(paintingGeometry, paintingMaterial);
            
            // Add frame
            const frameGeometry = new THREE.PlaneGeometry(size.width * 0.5 + 0.1, size.height * 0.5 + 0.1);
            const frameMaterial = new THREE.MeshBasicMaterial({ 
              color: 0x8B4513, // Brown frame
              side: THREE.DoubleSide
            });
            const frame = new THREE.Mesh(frameGeometry, frameMaterial);
            frame.position.z = -0.01; // Slightly behind the painting
            
            paintingGroup.add(frame);
            paintingGroup.add(painting);
            
            return paintingGroup;
          }

          // Store all game machines for click detection
          const gameMachines = [];
          const allTextScreens = [];

          // ArcadeAisle component - creates a complete aisle with two rows facing each other
          function ArcadeAisle({ games, position, geometry, aisleWidth = 2.0 }) {
            const aisleGroup = new THREE.Group();
            aisleGroup.position.copy(position);
            
            const machineWidth = 0.4;
            const wallPadding = 0.4;
            const availableWidth = aisleWidth - wallPadding;
            const maxMachines = Math.ceil(availableWidth / machineWidth);
            const aisleGames = games.slice(0, maxMachines);
            
            // Calculate spacing to distribute machines evenly
            const totalSpacing = availableWidth - (maxMachines * machineWidth);
            const spacingBetween = maxMachines > 1 ? totalSpacing / (maxMachines - 1) : 0;
            
            // First row - facing inward
            aisleGames.forEach((game, index) => {
              const xPosition = -aisleWidth / 2 + 0.2 + (index * machineWidth) + (index * spacingBetween);
              const machinePosition = new THREE.Vector3(xPosition, 0.6, -0.3); // Increased gap (was -0.1)
              
              const machine = ArcadeMachine({ game, position: machinePosition, geometry });
              aisleGroup.add(machine.group);
            });
            
            // Second row - facing inward from the other side
            aisleGames.forEach((game, index) => {
              const xPosition = -aisleWidth / 2 + 0.2 + (index * machineWidth) + (index * spacingBetween);
              const machinePosition = new THREE.Vector3(xPosition, 0.6, 0.3); // Increased gap (was 0.1)
              
              const machine = ArcadeMachine({ game, position: machinePosition, geometry, rotation: Math.PI });
              aisleGroup.add(machine.group);
            });
            
            return aisleGroup;
          }

          // ArcadeMachine component
          function ArcadeMachine({ game, position, geometry, rotation = 0 }) {
            // Create a group to hold all parts of the arcade machine
            const arcadeGroup = new THREE.Group();
            arcadeGroup.position.copy(position);
            arcadeGroup.rotation.y = rotation; // Rotate the entire group
            
            // Load machine texture with error handling
            const machineTexture = new THREE.TextureLoader().load(
              '/machineTexture.png',
              (texture) => {
                console.log('Machine texture loaded successfully');
                texture.wrapS = THREE.ClampToEdgeWrapping; // Use clamp instead of repeat
                texture.wrapT = THREE.ClampToEdgeWrapping; // Use clamp instead of repeat
                texture.magFilter = THREE.NearestFilter; // Pixelated stretching
                texture.minFilter = THREE.NearestFilter; // Pixelated stretching
                // Don't set repeat - let the OBJ's UV coordinates handle mapping
                texture.needsUpdate = true;
              },
              undefined,
              (error) => {
                console.error('Error loading machine texture:', error);
              }
            );
            const cabinetMaterial = new THREE.MeshLambertMaterial({ 
              map: machineTexture,
              color: 0x8B4513 // Fallback brown color if texture fails
            });
            const cabinet = new THREE.Mesh(geometry, cabinetMaterial);
            
            // Scale and position the cabinet relative to the group
            cabinet.scale.set(0.005, 0.005, 0.005);
            cabinet.rotation.x = -Math.PI / 2; // Rotate on X-axis to stand upright
            cabinet.position.set(0, -0.15, 0); // Relative to group center
            cabinet.userData = { game: game, type: 'cabinet' };
            arcadeGroup.add(cabinet);
            
            // Create screen with same dimensions
            const screenGeometry = new THREE.PlaneGeometry(0.288, 0.162); // 1/10 scale (16:9 aspect ratio)
            const screenMaterial = new THREE.MeshBasicMaterial({ 
              color: 0x333333, // Brighter base color
              transparent: true,
              opacity: 1.0
            });
            const screen = new THREE.Mesh(screenGeometry, screenMaterial);
            screen.position.set(0, 0.05, -0.01); // Moved further forward (was 0.3, now 0.5)
            screen.rotation.x = Math.PI;
            screen.userData = { game: game, type: 'screen' };
            arcadeGroup.add(screen);
            
          // Create game name texture with thumbnail
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = 800;
          canvas.height = 450; // 16:9 aspect ratio
          
          // Draw background
          context.fillStyle = '#000000';
          context.fillRect(0, 0, canvas.width, canvas.height);
          
          // Draw game thumbnail if available
          const thumbnailUrl = game.thumbnailUrl || game.ThumbnailUrl || '';
          if (thumbnailUrl) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              // Draw thumbnail at the top with proper aspect ratio
              const maxThumbnailWidth = 200;
              const maxThumbnailHeight = 150;
              const thumbnailY = 50;
              
              // Calculate dimensions maintaining aspect ratio
              const aspectRatio = img.width / img.height;
              let thumbnailWidth, thumbnailHeight;
              
              if (aspectRatio > maxThumbnailWidth / maxThumbnailHeight) {
                // Image is wider - fit to width
                thumbnailWidth = maxThumbnailWidth;
                thumbnailHeight = maxThumbnailWidth / aspectRatio;
              } else {
                // Image is taller - fit to height
                thumbnailHeight = maxThumbnailHeight;
                thumbnailWidth = maxThumbnailHeight * aspectRatio;
              }
              
              const thumbnailX = (canvas.width - thumbnailWidth) / 2;
              
              context.drawImage(img, thumbnailX, thumbnailY, thumbnailWidth, thumbnailHeight);
              
              // Draw game name below thumbnail with yellow text and black outline
              context.font = 'bold 36px monospace';
              context.textAlign = 'center';
              context.textBaseline = 'middle';
              
              // Draw black outline
              context.strokeStyle = '#000000';
              context.lineWidth = 4;
              context.strokeText(game.Name || game.name || 'Unknown Game', canvas.width / 2, thumbnailY + thumbnailHeight + 60);
              
              // Draw yellow text
              context.fillStyle = '#ffff00';
              context.fillText(game.Name || game.name || 'Unknown Game', canvas.width / 2, thumbnailY + thumbnailHeight + 60);
              
              // Update texture
              texture.needsUpdate = true;
            };
            img.onerror = () => {
              // If image fails to load, just draw the name with yellow text and black outline
              context.font = 'bold 48px monospace';
              context.textAlign = 'center';
              context.textBaseline = 'middle';
              
              // Draw black outline
              context.strokeStyle = '#000000';
              context.lineWidth = 4;
              context.strokeText(game.Name || game.name || 'Unknown Game', canvas.width / 2, canvas.height / 2);
              
              // Draw yellow text
              context.fillStyle = '#ffff00';
              context.fillText(game.Name || game.name || 'Unknown Game', canvas.width / 2, canvas.height / 2);
              texture.needsUpdate = true;
            };
            img.src = thumbnailUrl;
          } else {
            // No thumbnail, just draw game name with yellow text and black outline
            context.font = 'bold 48px monospace';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            
            // Draw black outline
            context.strokeStyle = '#000000';
            context.lineWidth = 4;
            context.strokeText(game.Name || game.name || 'Unknown Game', canvas.width / 2, canvas.height / 2);
            
            // Draw yellow text
            context.fillStyle = '#ffff00';
            context.fillText(game.Name || game.name || 'Unknown Game', canvas.width / 2, canvas.height / 2);
          }
            
            // Create texture from canvas
            const texture = new THREE.CanvasTexture(canvas);
            const textMaterial = new THREE.MeshBasicMaterial({ 
              map: texture,
              transparent: true,
              emissive: 0x222222, // Subtle emissive glow
              emissiveIntensity: 0.3
            });
            const textScreen = new THREE.Mesh(screenGeometry, textMaterial);
            textScreen.position.copy(screen.position);
            textScreen.position.z += -0.01;
            textScreen.rotation.x -= 135;
            textScreen.rotation.z -= 3.14;
            textScreen.userData = { game: game, type: 'textScreen' };
            arcadeGroup.add(textScreen);
            
            return { cabinet, screen, textScreen, group: arcadeGroup };
          }

          // Load cabinet.obj model first
          OBJLoader.load(
            '/cabinet.obj',
            (geometry) => {

              // Create multiple aisles to fit all games
              const aisleWidth = 4.0; // Fixed aisle width
              const aisleSpacing = 1.5; // Space between aisles
              const gamesPerAisle = 10; // Games per aisle
              const totalGames = (prefetchedGames || []).length;
              const requiredAisles = Math.ceil(totalGames / gamesPerAisle);
              const endPadding = 3.0; // Same as room calculation
              const totalPadding = endPadding * 2; // Padding on both ends
              const availableDepth = roomConfig.depth - totalPadding; // Available space for aisles
              const startZ = -roomConfig.depth / 2 + 0.5 + endPadding; // Start position with front padding
              
              for (let aisleIndex = 0; aisleIndex < requiredAisles; aisleIndex++) {
                const aislePosition = new THREE.Vector3(
                  0, 
                  0, 
                  startZ + (aisleIndex * aisleSpacing) // Distribute aisles in available space only
                );
                
                const aisle = ArcadeAisle({ 
                  games: (prefetchedGames || []).slice(aisleIndex * gamesPerAisle, (aisleIndex + 1) * gamesPerAisle),
                  position: aislePosition, 
                  geometry, 
                  aisleWidth: aisleWidth
                });
                
                scene.add(aisle);
                
                // Collect all machines from this aisle for click detection
                aisle.traverse((child) => {
                  if (child.userData && child.userData.type === 'textScreen') {
                    allTextScreens.push(child);
                  }
                });
              }
              
              console.log('Created', gameMachines.length, 'arcade machines');

              // Track hover state for crosshair
              let isHoveringGame = false;

              // Now define the click handler with access to all game machines
              handleGameClick = (event) => {
                if (document.pointerLockElement === el) {
                  // Raycast to check if clicking on any game screen
                  const raycaster = new THREE.Raycaster();
                  const mouse = new THREE.Vector2(0, 0); // Center of screen
                  
                  raycaster.setFromCamera(mouse, camera);
                  const intersects = raycaster.intersectObjects(allTextScreens);
                  
                  if (intersects.length > 0) {
                    const clickedObject = intersects[0].object;
                    const game = clickedObject.userData.game;
                    const gameName = game ? (game.Name || game.name || 'Unknown Game') : 'Unknown Game';
                    
                    // Extract gameId from playableURL like SocialStartScreen.js does
                    let gameId = '';
                    const playableURL = Array.isArray(game.playableURL) ? game.playableURL[0] : game.playableURL || '';
                    try {
                      if (playableURL) {
                        const path = playableURL.startsWith('http') ? new URL(playableURL).pathname : playableURL;
                        const m = /\/play\/([^\/?#]+)/.exec(path);
                        gameId = m && m[1] ? decodeURIComponent(m[1]) : '';
                      }
                    } catch (_) {
                      gameId = '';
                    }
                    
                    // Fallback to game.id if no playableURL
                    if (!gameId) {
                      gameId = game ? (game.id || game.Id || gameName) : 'unknown';
                    }
                    
                    // Release cursor when opening game
                    if (document.pointerLockElement === el) {
                      document.exitPointerLock();
                    }
                    
                    // Show PlayGameComponent in overlay (full screen)
                    overlay.innerHTML = `
                      <div style="width: 100vw; height: 100vh; position: fixed; top: 0; left: 0;">
                        <div id="play-game-container" style="width: 100%; height: 100%;"></div>
                      </div>
                    `;
                    overlay.style.display = 'flex';
                    overlay.style.backgroundColor = 'transparent'; // Remove black background
                    
                    // Import and render PlayGameComponent
                    import('../components/utils/playGameComponent.js').then(({ default: PlayGameComponent }) => {
                      const container = document.getElementById('play-game-container');
                      if (container) {
                        // Create React root and render component
                        const root = createRoot(container);
                        root.render(React.createElement(PlayGameComponent, {
                          gameId: gameId,
                          gameName: gameName,
                          thumbnailUrl: game.thumbnailUrl || game.ThumbnailUrl || '',
                          width: '100%',
                          height: '100%',
                          style: { width: '100%', height: '100%' },
                          token: null, // No token in 3D mode
                          compact: false,
                          isFromMainPage: true
                        }));
                      }
                    }).catch(err => {
                      console.error('Failed to load PlayGameComponent:', err);
                      overlay.innerHTML = `<div>Error loading game: ${gameName}</div>`;
                    });
                  }
                }
              };

              // Update crosshair based on hover
              updateCrosshair = () => {
                if (document.pointerLockElement === el) {
                  const raycaster = new THREE.Raycaster();
                  const mouse = new THREE.Vector2(0, 0);
                  raycaster.setFromCamera(mouse, camera);
                  const intersects = raycaster.intersectObjects(allTextScreens);
                  
                  const hovering = intersects.length > 0;
                  if (hovering !== isHoveringGame) {
                    isHoveringGame = hovering;
                    crosshair.style.opacity = hovering ? '1.0' : '0.4'; // Full opacity when hovering, low when not
                  }
                }
              };

              // Add the click event listener now that handleGameClick is defined
              el.addEventListener('click', handleGameClick);
            },
            undefined,
            (error) => {
              console.error('Error loading cabinet.obj:', error);
              // Fallback to a simple cube if loading fails
              const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
              const cubeMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
              const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
              cube.position.set(0, 0.5, 0);
              scene.add(cube);
            }
          );

          // Position camera at ground level like a player (in the open area at the end)
          const spawnZ = roomConfig.depth / 2 - 1.5; // Position in the end space area
          camera.position.set(0, 0.75, spawnZ); // Player height in the open area
          camera.rotation.set(0, 0, 0); // Reset all rotations
          camera.lookAt(0, 0.75, spawnZ - 1); // Look towards the arcade machines
          
          // Camera rotation (like Minecraft)
          let yaw = 0; // Left/right rotation
          let pitch = 0; // Up/down rotation

          // Player movement variables
          const baseMoveSpeed = 0.02; // Half of current speed (0.04 / 2 = 0.02)
          const sprintMultiplier = 4; // 4x speed when holding shift
          const keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            shift: false
          };
          
          // Collision detection function
          const checkCollision = (newPosition) => {
            // Check room boundaries
            const halfWidth = roomConfig.width / 2;
            const halfDepth = roomConfig.depth / 2;
            const wallThickness = roomConfig.wallThickness;
            
            // Room boundary collision (with wall thickness buffer)
            if (newPosition.x < -halfWidth + wallThickness || 
                newPosition.x > halfWidth - wallThickness ||
                newPosition.z < -halfDepth + wallThickness || 
                newPosition.z > halfDepth - wallThickness) {
              return true;
            }
            
            // Check collision with arcade machines (allow closer approach)
            const machineRadius = 0.15; // Smaller machine collision radius (was 0.3)
            const playerRadius = 0.1; // Smaller player collision radius (was 0.2)
            
            for (const textScreen of allTextScreens) {
              if (textScreen.userData && textScreen.userData.type === 'textScreen') {
                const machineWorldPos = new THREE.Vector3();
                textScreen.getWorldPosition(machineWorldPos);
                
                const distance = newPosition.distanceTo(new THREE.Vector3(machineWorldPos.x, newPosition.y, machineWorldPos.z));
                if (distance < machineRadius + playerRadius) {
                  return true;
                }
              }
            }
            
            return false;
          };

          // Mouse look variables
          let isMouseDown = false;

          // Keyboard controls
          const handleKeyDown = (event) => {
            switch(event.code) {
              case 'KeyW': keys.w = true; break;
              case 'KeyA': keys.a = true; break;
              case 'KeyS': keys.s = true; break;
              case 'KeyD': keys.d = true; break;
              case 'ShiftLeft':
              case 'ShiftRight': keys.shift = true; break;
            }
          };

          const handleKeyUp = (event) => {
            switch(event.code) {
              case 'KeyW': keys.w = false; break;
              case 'KeyA': keys.a = false; break;
              case 'KeyS': keys.s = false; break;
              case 'KeyD': keys.d = false; break;
              case 'ShiftLeft':
              case 'ShiftRight': keys.shift = false; break;
            }
          };

          // Mouse controls with pointer lock
          const handleMouseDown = (event) => {
            el.requestPointerLock();
          };

          const handleMouseMove = (event) => {
            if (document.pointerLockElement === el) {
              yaw -= event.movementX * 0.002;
              pitch -= event.movementY * 0.002; // Fixed: inverted mouse Y movement
              pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
            }
          };

          const handlePointerLockChange = () => {
            if (document.pointerLockElement !== el) {
              // Pointer lock lost, reset any states if needed
            }
          };

          // Create overlay div for game display
          const overlay = document.createElement('div');
          overlay.style.position = 'fixed';
          overlay.style.top = '0';
          overlay.style.left = '0';
          overlay.style.width = '100vw';
          overlay.style.height = '100vh';
          overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
          overlay.style.display = 'none';
          overlay.style.justifyContent = 'center';
          overlay.style.alignItems = 'center';
          overlay.style.zIndex = '1000';
          overlay.style.color = '#00ff00';
          overlay.style.fontSize = '48px';
          overlay.style.fontFamily = 'monospace';
          overlay.style.fontWeight = 'bold';
          document.body.appendChild(overlay);

          // Create crosshair
          const crosshair = document.createElement('div');
          crosshair.style.position = 'fixed';
          crosshair.style.top = '50%';
          crosshair.style.left = '50%';
          crosshair.style.transform = 'translate(-50%, -50%)';
          crosshair.style.width = '20px';
          crosshair.style.height = '20px';
          crosshair.style.pointerEvents = 'none';
          crosshair.style.zIndex = '999';
          crosshair.style.color = 'white';
          crosshair.style.opacity = '0.4'; // Default opacity when not hovering
          crosshair.innerHTML = '+';
          crosshair.style.fontSize = '20px';
          crosshair.style.fontWeight = 'bold';
          crosshair.style.textAlign = 'center';
          crosshair.style.lineHeight = '20px';
          document.body.appendChild(crosshair);

          // Handle escape key to close overlay
          const handleEscapeKey = (event) => {
            if (event.key === 'Escape') {
              overlay.style.display = 'none';
              overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'; // Restore original background
              // Re-request pointer lock when closing game
              if (el && !document.pointerLockElement) {
                el.requestPointerLock().catch(err => {
                  console.log('Pointer lock request failed:', err);
                });
              }
            }
          };

          // Handle click detection for game screen - will be defined after textScreen is created
          let handleGameClick = null;
          let textScreen = null; // Declare textScreen in the proper scope
          let updateCrosshair = null; // Declare updateCrosshair in the proper scope

          // Add event listeners
          window.addEventListener('keydown', handleKeyDown);
          window.addEventListener('keydown', handleEscapeKey);
          window.addEventListener('keyup', handleKeyUp);
          el.addEventListener('mousedown', handleMouseDown);
          window.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('pointerlockchange', handlePointerLockChange);

          // Animation loop
          const animate = () => {
            requestAnimationFrame(animate);

            // Update camera rotation (Minecraft style)
            camera.rotation.set(pitch, yaw, 0); // X=pitch, Y=yaw, Z=0 (no roll)

            // Handle WASD movement (Minecraft style)
            const direction = new THREE.Vector3();
            
            // Calculate movement direction based on camera rotation (ground plane only)
            const forward = new THREE.Vector3();
            forward.setFromSphericalCoords(1, Math.PI/2 - pitch, yaw);
            forward.y = 0; // Keep on ground plane
            forward.normalize();
            
            // Invert forward direction to match expected controls
            forward.multiplyScalar(-1);

            const right = new THREE.Vector3();
            right.crossVectors(forward, new THREE.Vector3(0, 1, 0));
            right.normalize();

            // Apply movement
            if (keys.w) direction.add(forward);
            if (keys.s) direction.sub(forward);
            if (keys.a) direction.sub(right);
            if (keys.d) direction.add(right);

            // Move camera (ground plane only) with collision detection and sprint
            if (direction.length() > 0) {
              direction.normalize();
              direction.y = 0; // Ensure no vertical movement
              
              // Calculate speed (base speed + sprint multiplier)
              const currentSpeed = keys.shift ? baseMoveSpeed * sprintMultiplier : baseMoveSpeed;
              
              // Calculate new position
              const newPosition = camera.position.clone().add(direction.multiplyScalar(currentSpeed));
              
              // Check collision before moving
              if (!checkCollision(newPosition)) {
                camera.position.copy(newPosition);
              }
            }

            // Keep camera at ground level (prevent flying)
            camera.position.y = 0.75;

            // Update crosshair based on what we're looking at
            if (updateCrosshair) {
              updateCrosshair();
            }

            // Render the scene
            renderer.render(scene, camera);
          };
          animate();

          // Handle window resize
          const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
          };
          window.addEventListener('resize', handleResize);
        }}
      />
      
    </div>
  );
}

// No getStaticProps needed - data is passed from parent component
