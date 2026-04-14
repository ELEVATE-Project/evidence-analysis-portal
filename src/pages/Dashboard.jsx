import React from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ListAltIcon from '@mui/icons-material/ListAlt';
import ScienceIcon from '@mui/icons-material/Science';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();

  const cards = [
    {
      title: 'Create Execution',
      description: 'Start a new evidence analysis execution',
      icon: <AddCircleIcon sx={{ fontSize: 60, color: 'primary.main' }} />,
      action: () => navigate('/executions/create'),
      buttonText: 'Create New',
    },
    {
      title: 'View Executions',
      description: 'Browse and manage your executions',
      icon: <ListAltIcon sx={{ fontSize: 60, color: 'primary.main' }} />,
      action: () => navigate('/executions'),
      buttonText: 'View All',
    },
    {
      title: 'Interactive Testing',
      description: 'Test evidence validation interactively',
      icon: <ScienceIcon sx={{ fontSize: 60, color: 'primary.main' }} />,
      action: () => navigate('/testing'),
      buttonText: 'Start Testing',
    },
  ];

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Welcome to the Evidence Analysis System
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {cards.map((card, index) => (
          <Grid item xs={12} md={4} key={index}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <Box sx={{ mb: 2 }}>
                  {card.icon}
                </Box>
                <Typography variant="h6" gutterBottom>
                  {card.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {card.description}
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                <Button variant="contained" onClick={card.action}>
                  {card.buttonText}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default Dashboard;
