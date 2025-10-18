package services

import (
	"context"
	"strconv"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
)

type DockerManager struct {
	client *client.Client
}

func NewDockerManager() (*DockerManager, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}
	return &DockerManager{client: cli}, nil
}

func (dm *DockerManager) CreateRasaContainer(instanceName string, port int) (string, error) {
	ctx := context.Background()

	config := &container.Config{
		Image: "docubot-rasa:latest",
		Cmd: []string{
			"bash", "-c",
			"rasa run actions --port 5055 --debug & rasa run --enable-api --cors '*' --port 5005 --debug",
		},
		ExposedPorts: nat.PortSet{
			"5005/tcp": struct{}{},
			"5055/tcp": struct{}{},
		},
	}

	hostConfig := &container.HostConfig{
		PortBindings: nat.PortMap{
			"5005/tcp": []nat.PortBinding{{HostIP: "0.0.0.0", HostPort: strconv.Itoa(port)}},
			"5055/tcp": []nat.PortBinding{{HostIP: "0.0.0.0", HostPort: strconv.Itoa(port + 50)}},
		},
		RestartPolicy: container.RestartPolicy{Name: "unless-stopped"},
	}

	resp, err := dm.client.ContainerCreate(ctx, config, hostConfig, nil, nil, instanceName)
	if err != nil {
		return "", err
	}

	if err := dm.client.ContainerStart(ctx, resp.ID, types.ContainerStartOptions{}); err != nil {
		return "", err
	}

	return resp.ID, nil
}

func (dm *DockerManager) StopContainer(containerID string) error {
	ctx := context.Background()
	timeout := 30
	return dm.client.ContainerStop(ctx, containerID, container.StopOptions{Timeout: &timeout})
}

func (dm *DockerManager) RemoveContainer(containerID string) error {
	ctx := context.Background()
	return dm.client.ContainerRemove(ctx, containerID, types.ContainerRemoveOptions{Force: true})
}
