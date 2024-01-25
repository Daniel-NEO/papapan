window.addEventListener('DOMContentLoaded', (event) => {
    var Engine = Matter.Engine,
        Render = Matter.Render,
        World = Matter.World,
        Bodies = Matter.Bodies

    var engine = Engine.create(),
        world = engine.world;

    var renderWidth = Math.min(document.documentElement.clientWidth - 100, 750);
    var renderHeight = renderWidth * 0.9; // Height is 75% of the width

    var render = Render.create({
        element: document.getElementById('world'),
        engine: engine,
        options: {
            width: renderWidth,
            height: renderHeight,
            wireframes: false
        }
    });

    render.canvas.style.backgroundColor = '#e3dcbf';


    const rowWidth = renderWidth / 20; // Adjust this value to change the distance between rows
    const colWidth = renderWidth / 15; // Adjust this value to change the distance between columns
    const textArray = ['100% off', '75% off', '50% off', '25% off', '10% off', '0% off', '0% off', '0% off', '10% off', '25% off', '50% off', '75% off', '100% off']; // Add or remove text values as needed
    const textYOffset = -renderWidth / 100; // Y offset for the text from the top of the pillars

    var ball = Bodies.circle(renderWidth / 2, 0, renderWidth / 100, {
        density: 0.04,
        frictionAir: 0.01,
        restitution: 0.8,
        friction: 0.01,
        render: { fillStyle: 'blue' }
    });

    var floor = Bodies.rectangle(400, renderHeight, 810, 60, {
        isStatic: true,
        render: { fillStyle: 'black' }
    });

    function createPyramid() {
        const numRows = 12; // Number of rows in the pyramid
        const startX = renderWidth / 2; // Starting X position
        const startY = 50; // Starting Y position

        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col <= row; col++) {
                const x = startX + col * colWidth - row * colWidth / 2;
                const y = startY + row * rowWidth;

                const obstacle = Bodies.circle(x, y, renderWidth / 90, {
                    isStatic: true,
                    render: { fillStyle: 'red' }
                });

                World.add(world, obstacle);
            }
        }
    }

    createPyramid();

    const xVelocity = renderWidth / 500; // Change this value to set the X velocity
    const yVelocity = renderWidth / 1100; // Change this value to set the Y velocity


    // Add collision event listener
    Matter.Events.on(engine, 'collisionStart', function (event) {
        console.log(ball.position.y);
        var pairs = event.pairs;

        for (var i = 0, j = pairs.length; i != j; ++i) {
            var pair = pairs[i];

            // Check if the ball is involved in the collision
            if (ball && (pair.bodyA === ball || pair.bodyB === ball)) {
                var otherBody = pair.bodyA === ball ? pair.bodyB : pair.bodyA;

                // Check if the other body is an obstacle
                if (otherBody.render.fillStyle === 'red') {
                    // Teleport the ball to the same X coordinate as the obstacle and above it
                    Matter.Body.setPosition(ball, { x: otherBody.position.x, y: otherBody.position.y - ball.circleRadius - 13 });

                    // Clear the current velocity of the ball
                    Matter.Body.setVelocity(ball, { x: 0, y: 0 });
                    Matter.Body.setStatic(ball, true);

                    // Set the new velocity of the ball
                    setTimeout(function () {
                        Matter.Body.setStatic(ball, false);
                        if (ball.position.x > renderWidth / 2) {
                            Matter.Body.setVelocity(ball, { x: Math.random() < 0.8 ? xVelocity : -xVelocity, y: -yVelocity });
                        }
                        else if (ball.position.x < renderWidth / 2) {
                            Matter.Body.setVelocity(ball, { x: Math.random() < 0.2 ? xVelocity : -xVelocity, y: -yVelocity });
                        }
                        else {
                            Matter.Body.setVelocity(ball, { x: Math.random() < 0.5 ? xVelocity : -xVelocity, y: -yVelocity });
                        }

                    }, 50); // 1000 milliseconds = 1 second
                }
            }

            if (((pair.bodyA === ball && pair.bodyB === floor) || (pair.bodyA === floor && pair.bodyB === ball) || ball.position.y > renderHeight - (renderHeight / 5))&& ballExists == true ) {
                ballExists = false; // The ball has hit the floor and can be replaced
                const winIndex = Math.floor((ball.position.x - pillarShift) / gap-1);
                const winPercentage = textArray[winIndex]; // get the percentage based on where the ball lands
                document.getElementById('winMessage').textContent = `You won: ${winPercentage}`;
                notifyBallHit(winPercentage.substring(0,winPercentage.indexOf('%')));
                showPopup();
            }

        }
    });

    var ballExists = false;

    function spawnBall() {
        if (!ballExists) { // Check if there's no ball currently
            ball = Bodies.circle(renderWidth / 2, 0, renderWidth / 100, {
                density: 0.04,
                frictionAir: 0.01,
                restitution: 0.8,
                friction: 0.01,
                render: { fillStyle: 'blue' }
            });
            World.add(world, ball);
            ballExists = true; // Set the flag to true as the ball is now in the simulation
            notifyBallSpawned();
            hidePopup();
        }
    }

    const pillarWidth = renderWidth / 300; // Adjust this value to change pillar width
    const pillarHeight = renderHeight / 5; // Adjust this value to change pillar height
    const numberOfPillars = 14; // Number of pillars
    const gap = renderWidth / 15; // Gap between pillars
    const pillarShift = -renderWidth / 1000;

    // Function to create pillars
    function createPillars() {
        const startX = gap - (pillarWidth / 2) + pillarShift; // Adjust starting X position by the shift value
        for (let i = 0; i < numberOfPillars; i++) {
            const x = startX + i * gap;
            const y = renderHeight - (pillarHeight / 2);

            const pillar = Bodies.rectangle(x, y, pillarWidth, pillarHeight, {
                isStatic: true,
                render: { fillStyle: 'white' }
            });

            World.add(world, pillar);
        }
    }

    createPillars();

    // Attach event listener to the reset button
    document.getElementById('spawnBall').addEventListener('click', spawnBall);

    World.add(world, [floor]);
    Engine.run(engine);
    Render.run(render);

    const canvas = render.canvas;
    const ctx = canvas.getContext('2d');
    ctx.font = '20px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    const textBaseY = renderHeight - pillarHeight + textYOffset;

    // Function to draw text
    function drawText() {
        const canvas = render.canvas;
        const ctx = canvas.getContext('2d');
        const textBaseY = renderHeight - pillarHeight + textYOffset;
        const startX = gap - (pillarWidth / 2) + pillarShift + renderWidth / 30;
        const fontSize = renderWidth / 60;

        ctx.save(); // Save the current state of the canvas

        ctx.font = `${fontSize}px Arial`;
        ctx.fillStyle = 'white'; // Set the fill style to white for the text
        ctx.textAlign = 'center';

        for (let i = 0; i < numberOfPillars - 1; i++) {
            const x = startX + i * gap;
            ctx.fillText(textArray[i], x, textBaseY);
        }

        ctx.restore(); // Restore the canvas state
    }

    // Call the function to draw the text
    drawText();

    // Redraw text every time the canvas is cleared
    Matter.Events.on(render, 'afterRender', function () {
        drawText();
    });

    document.getElementById('closePopup').addEventListener('click', function() {
        hidePopup();
    });

    // Function to show the popup
function showPopup() {
    var popup = document.getElementById('winPopup');
    popup.classList.remove('leave');
    popup.classList.add('enter');
    popup.style.display = 'block'; // Make the popup visible
}

// Function to hide the popup
function hidePopup() {
    var popup = document.getElementById('winPopup');
    popup.classList.remove('enter');
    popup.classList.add('leave');
    setTimeout(function() {
        popup.style.display = 'none'; // Hide the popup after the animation
    }, 50); // This should match the duration of the leave animation
}


});
