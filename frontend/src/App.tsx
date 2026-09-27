import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery } from "@apollo/client";
import { CREATE_USER, GET_USERS } from "./graphql/mutations";

function App() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
  });
  const [message, setMessage] = useState("");

  const { data, refetch } = useQuery<{
    getUsers: Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      status: string;
    }>;
  }>(GET_USERS);

  const [createUser] = useMutation(CREATE_USER);

  const handleSubmit = async () => {
    setMessage("");
    try {
      const { data: res } = await createUser({ variables: { data: form } });
      setMessage(res?.createUser ?? "Created");
      setForm({ firstName: "", lastName: "", email: "", password: "", phone: "" });
      refetch();
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(t);
  }, [message]);

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        FinVault — Create User
      </Typography>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <TextField
              label="First Name"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
            <TextField
              label="Last Name"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
            <TextField
              label="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <TextField
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <TextField
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Button variant="contained" onClick={handleSubmit}>
              Create User
            </Button>
            {message && <Typography color="primary">{message}</Typography>}
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ mt: 4 }}>
        Users
      </Typography>
      <Stack spacing={1} sx={{ mt: 2 }}>
        {data?.getUsers?.map((u) => (
          <Card key={u.id}>
            <CardContent>
              <Typography>
                {u.firstName} {u.lastName} — {u.email} ({u.status})
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Container>
  );
}

export default App;